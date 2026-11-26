import Combine
import Foundation
import CommonplaceKit

/// Shared session state: server URL, auth flag, pins cache, timer persistence.
/// Timer persistence mirrors the web client's `time_timer_v1` localStorage
/// record `{key, kind, startedAt}` so a running timer survives relaunch.
@MainActor
final class AppState: ObservableObject {
    @Published var serverURLString: String {
        didSet { UserDefaults.standard.set(serverURLString, forKey: "serverURL") }
    }
    @Published var username: String {
        didSet { UserDefaults.standard.set(username, forKey: "username") }
    }
    @Published var isSignedIn = false
    @Published var authChecking = true
    @Published var authError: String?
    @Published var unreachable = false
    @Published var pins: [PinItem] = []
    @Published var lastPinError: String?
    /// Route hint saved on 401 so sign-in can restore it (web redirect-restore).
    @Published var pendingRoute: String? {
        didSet { UserDefaults.standard.set(pendingRoute, forKey: "pending_route") }
    }

    private let pinQueueKey = "pin_queue_v1"
    private var pinQueue: [PinSyncOp] = []
    private var pinSyncInFlight = false
    private var pinSyncAgain = false

    @Published var timerSubjectKey: String?
    @Published var timerSubjectLabel: String?
    @Published var timerKind = "writing"
    @Published var timerStartedAt: Date?
    /// Minutes logged today (all kinds), shown next to the timer.
    @Published var todayTotalMinutes: Int = 0
    /// Open (pending) maintenance tasks, for the sidebar dot.
    @Published var maintenancePending: Int = 0
    /// Library totals shown grey beside sidebar sections.
    @Published var counts: StatsCounts?
    /// Last unfiltered recent-notes page, so returning to the Notes
    /// section shows instantly instead of re-querying from scratch.
    var recentNotesCache: [Note] = []

    var timerIsRunning: Bool { timerStartedAt != nil }

    init() {
        let stored = UserDefaults.standard.string(forKey: "serverURL")
        serverURLString = stored ?? "http://localhost:3000/api"
        username = UserDefaults.standard.string(forKey: "username") ?? "commonplace"
        pendingRoute = UserDefaults.standard.string(forKey: "pending_route")
        if let data = UserDefaults.standard.data(forKey: "time_timer_v1"),
           let obj = try? JSONDecoder().decode([String: String].self, from: data),
           let key = obj["key"], let kind = obj["kind"],
           let at = obj["startedAt"], let date = ISO8601DateFormatter().date(from: at) {
            timerSubjectKey = key
            timerSubjectLabel = obj["label"]
            timerKind = kind
            timerStartedAt = date
        }
        if let data = UserDefaults.standard.data(forKey: pinQueueKey),
           let queue = try? JSONDecoder().decode([PinSyncOp].self, from: data) {
            pinQueue = queue
        }
    }

    var client: APIClient {
        let url = URL(string: serverURLString) ?? URL(string: "http://localhost:3000/api")!
        return APIClient(baseURL: url)
    }

    /// The web app for this server (the API base minus its /api suffix).
    var webURL: URL? {
        var s = serverURLString
        if s.hasSuffix("/api") { s = String(s.dropLast(4)) }
        if s.hasSuffix("/") { s = String(s.dropLast()) }
        return URL(string: s)
    }

    /// A specific page on the web app, e.g. webURL(path: "note/abc").
    func webURL(path: String) -> URL? {
        webURL?.appendingPathComponent(path)
    }

    /// The standard nick fetch for entity pages (nil on any failure).
    func nick(type: String, id: String) async -> String? {
        (try? await client.nickFor(type: type, id: id))?.key
    }

    /// Refresh the open-maintenance count behind the sidebar dot.
    func refreshMaintenancePending() async {
        guard isSignedIn else { return }
        if let tasks = try? await client.maintenanceList() {
            maintenancePending = tasks.filter { $0.pending == true }.count
        }
    }

    /// Refresh library totals for the sidebar counts.
    func refreshCounts() async {
        guard isSignedIn else { return }
        counts = try? await client.stats()
    }

    func persistTimer() {
        guard let key = timerSubjectKey, let at = timerStartedAt else { return }
        let s = ISO8601DateFormatter().string(from: at)
        var obj = ["key": key, "kind": timerKind, "startedAt": s]
        if let label = timerSubjectLabel { obj["label"] = label }
        if let data = try? JSONEncoder().encode(obj) {
            UserDefaults.standard.set(data, forKey: "time_timer_v1")
        }
    }

    /// Stop the running timer and log it (menu-bar / any scene). Uses the
    /// persisted subject key: pile:<id>, work:<id>, or title:<slug>.
    func stopAndLogTimer() async {
        guard let key = timerSubjectKey, let at = timerStartedAt else { return }
        let minutes = max(1, Int((Date().timeIntervalSince(at) / 60).rounded()))
        let day = {
            let f = DateFormatter()
            f.calendar = Calendar(identifier: .gregorian)
            f.locale = Locale(identifier: "en_US_POSIX")
            f.timeZone = TimeZone(secondsFromGMT: 0)
            f.dateFormat = "yyyy-MM-dd"
            return f.string(from: Date())
        }()
        let iso = ISO8601DateFormatter()
        var body = TimeEntryBody(kind: timerKind, minutes: minutes, date: day,
                                 startedAt: iso.string(from: at), endedAt: iso.string(from: Date()))
        if key.hasPrefix("pile:") {
            body.pile = String(key.dropFirst(5))
        } else if key.hasPrefix("work:") {
            body.work = String(key.dropFirst(5))
        } else if key.hasPrefix("title:") {
            body.title = String(key.dropFirst(6))
        } else {
            body.title = key
        }
        do {
            _ = try await client.createTimeEntry(body)
            clearTimer()
            await refreshTodayTotal()
        } catch {
            // Keep the timer running so no time is lost.
        }
    }

    func clearTimer() {
        timerSubjectKey = nil
        timerSubjectLabel = nil
        timerStartedAt = nil
        UserDefaults.standard.removeObject(forKey: "time_timer_v1")
        Task { try? await client.clearRunningTimer() }
    }

    func startTimer(key: String, kind: String, label: String? = nil) {
        timerSubjectKey = key
        timerSubjectLabel = label
        timerKind = kind
        timerStartedAt = Date()
        persistTimer()
        let iso = ISO8601DateFormatter().string(from: timerStartedAt!)
        Task {
            try? await client.setRunningTimer(
                RunningTimerState(key: key, kind: kind, label: label, startedAt: iso))
        }
    }

    private var timerPollTask: Task<Void, Never>?

    /// Poll the shared timer every 5s so a timer started/stopped on
    /// another client (web, phone, Mac) shows up here without a relaunch.
    func startTimerPolling() {
        guard timerPollTask == nil else { return }
        timerPollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                if Task.isCancelled { break }
                await syncRunningTimer()
                await refreshTodayTotal()
            }
            timerPollTask = nil
        }
    }

    /// Reconcile with the server's running timer: the server copy wins
    /// when it exists (another client started it); a local-only timer
    /// is pushed up so the web sees it too.
    func syncRunningTimer() async {
        guard isSignedIn else { return }
        if let remote = try? await client.runningTimer(),
           let at = ISO8601DateFormatter().date(from: remote.startedAt) {
            timerSubjectKey = remote.key
            timerSubjectLabel = remote.label
            timerKind = remote.kind
            timerStartedAt = at
            persistTimer()
        } else if let key = timerSubjectKey, let at = timerStartedAt {
            try? await client.setRunningTimer(
                RunningTimerState(key: key, kind: timerKind,
                                  label: timerSubjectLabel,
                                  startedAt: ISO8601DateFormatter().string(from: at)))
        }
    }

    // Stars sync like the web client: the queued star/unstar shows at once
    // and is sent now; failures stay queued and ride along next time, so an
    // offline star is never silently dropped.
    func queuePin(type: String, id: String, label: String?, href: String?) {
        pinQueue.removeAll { $0.type == type && $0.id == id }
        pinQueue.append(PinSyncOp(op: "pin", type: type, id: id, label: label, href: href,
                                 at: Date().timeIntervalSince1970 * 1000))
        persistPinQueue()
        pins = applyPins(over: pins)
        Task { await syncPinQueue() }
    }

    func queueUnpin(type: String, id: String) {
        pinQueue.removeAll { $0.type == type && $0.id == id }
        pinQueue.append(PinSyncOp(op: "unpin", type: type, id: id,
                                 at: Date().timeIntervalSince1970 * 1000))
        persistPinQueue()
        pins = applyPins(over: pins)
        Task { await syncPinQueue() }
    }

    private func persistPinQueue() {
        if let data = try? JSONEncoder().encode(pinQueue) {
            UserDefaults.standard.set(data, forKey: pinQueueKey)
        }
    }

    private func applyPins(over confirmed: [PinItem]) -> [PinItem] {
        var items = confirmed
        for op in pinQueue {
            items.removeAll { $0.type == op.type && $0.id == op.id }
            if op.op == "pin" {
                items.insert(PinItem(type: op.type, id: op.id, label: op.label, href: op.href,
                                     pinnedAt: op.at, pending: true), at: 0)
            }
        }
        return items
    }

    func syncPinQueue() async {
        if pinSyncInFlight { pinSyncAgain = true; return }
        pinSyncInFlight = true
        defer { pinSyncInFlight = false }
        repeat {
            pinSyncAgain = false
            let sent = pinQueue
            do {
                let confirmed = try await client.syncPins(sent)
                // Drop exactly the ops sent; ops queued during the flight stay.
                let sentKeys = Set(sent.map { "\($0.op)|\($0.type)|\($0.id)|\($0.at ?? 0)" })
                pinQueue.removeAll { sentKeys.contains("\($0.op)|\($0.type)|\($0.id)|\($0.at ?? 0)") }
                persistPinQueue()
                pins = applyPins(over: confirmed)
                unreachable = false
                lastPinError = nil
            } catch let error as APIError {
                if case .transport = error {
                    unreachable = true
                } else {
                    lastPinError = "Star sync failed — will retry."
                }
                break
            } catch {
                lastPinError = "Star sync failed — will retry."
                break
            }
        } while pinSyncAgain
    }

    func refreshPins() async {
        await syncPinQueue()
    }

    /// Today's logged total for the menu bar / timer displays.
    func refreshTodayTotal() async {
        guard isSignedIn else { return }
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        if let summary = try? await client.timeSummary(date: f.string(from: Date())) {
            todayTotalMinutes = summary.daily?.totalMinutes ?? 0
        }
    }

    func validateSession() async {
        authChecking = true
        defer { authChecking = false }
        do {
            try await client.validateSession()
            isSignedIn = true
            authError = nil
            unreachable = false
        } catch let error as APIError {
            switch error {
            case .transport:
                // Server down or offline: keep the session, flag it.
                unreachable = true
            case .unauthorized, .forbidden:
                if isSignedIn { pendingRoute = pendingRoute ?? "notes" }
                isSignedIn = false
                authError = "Signed out — log in again."
            default:
                break
            }
        } catch {
            // Unknown error: leave auth state untouched.
        }
    }
}

extension Notification.Name {
    static let macNewNote = Notification.Name("macNewNote")
}

extension Notification.Name {
    static let macSection = Notification.Name("macSection")
}
