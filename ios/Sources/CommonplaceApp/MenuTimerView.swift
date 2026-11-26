import SwiftUI
import CommonplaceKit

#if os(macOS)
/// Menu bar timer: running timer (elapsed + kind) plus today's total,
/// or just today's total when idle. The popover can stop & log it.
struct MenuTimerLabel: View {
    @EnvironmentObject var state: AppState
    @State private var now = Date()

    // No TimelineView here: inside a MenuBarExtra label it re-invalidates
    // the host's status button in a tight loop at launch (app hangs at
    // 100% CPU resolving the symbol image). A 1s timer publisher ticks
    // the elapsed text without that feedback cycle.
    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var todayText: String {
        state.todayTotalMinutes > 0 ? formatMinutes(state.todayTotalMinutes) : ""
    }

    var body: some View {
        Group {
            if let at = state.timerStartedAt {
                Label(
                    formatElapsed(now.timeIntervalSince(at) * 1000)
                        + (state.timerKind == "reading" ? " R" : " W")
                        + (todayText.isEmpty ? "" : " · \(todayText) today"),
                    systemImage: "timer"
                )
            } else if !todayText.isEmpty {
                Label("\(todayText) today", systemImage: "timer")
            } else {
                Label("Timer", systemImage: "timer")
            }
        }
        .task { await state.refreshTodayTotal() }
        .onReceive(ticker) { tick in
            if state.timerStartedAt != nil { now = tick }
        }
    }
}

struct MenuTimerView: View {
    @EnvironmentObject var state: AppState
    @State private var now = Date()
    @State private var subjects: [RecentSubject] = []
    @State private var filter = ""

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let at = state.timerStartedAt {
                Text(formatElapsed(now.timeIntervalSince(at) * 1000))
                    .font(DS.ui(22, weight: .semibold))
                    .monospacedDigit()
                    .onReceive(ticker) { now = $0 }
                KindSubjectLine(kind: state.timerKind, subject: subjectName)
                if state.todayTotalMinutes > 0 {
                    HStack(spacing: 6) {
                        Text("TODAY")
                            .font(DS.ui(10, weight: .semibold)).tracking(0.8)
                            .foregroundStyle(DS.muted)
                        Text(formatMinutes(state.todayTotalMinutes))
                            .font(DS.ui(13, weight: .semibold)).monospacedDigit()
                    }
                }
                Button("Stop & log") {
                    Task { await state.stopAndLogTimer() }
                }
                Button("Open Time to modify…") {
                    NotificationCenter.default.post(name: .macSection, object: "time")
                    NSApp.activate(ignoringOtherApps: true)
                }
                Button("Discard timer", role: .destructive) {
                    state.clearTimer()
                }
            } else {
                Text("No timer running.").font(DS.ui(13)).foregroundStyle(DS.muted)
                if state.todayTotalMinutes > 0 {
                    HStack(spacing: 6) {
                        Text("TODAY")
                            .font(DS.ui(10, weight: .semibold)).tracking(0.8)
                            .foregroundStyle(DS.muted)
                        Text(formatMinutes(state.todayTotalMinutes))
                            .font(DS.ui(13, weight: .semibold)).monospacedDigit()
                    }
                }
                Button("Open Time…") {
                    NotificationCenter.default.post(name: .macSection, object: "time")
                    NSApp.activate(ignoringOtherApps: true)
                }
            }

            // Start a recent timer, Tyme-style: tap ▶ on a recent or
            // starred subject and it starts (switching logs the current
            // one first).
            Divider()
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass").font(DS.ui(11)).foregroundStyle(DS.faint)
                TextField("Start a recent timer", text: $filter)
                    .textFieldStyle(.plain)
                    .font(DS.ui(12))
            }
            recentGroup("Starred", rows: starredRows)
            recentGroup("Reading", rows: kindRows("reading"))
            recentGroup("Writing", rows: kindRows("writing"))
            recentGroup("Recent", rows: otherRows)
        }
        .padding(12)
        .frame(width: 260)
        .task { await loadRecents() }
    }

    private func loadRecents() async {
        subjects = (try? await state.client.recentSubjects(limit: 20)) ?? []
    }

    private var starredRows: [RecentSubject] {
        state.pins.filter { $0.type == "time" }.compactMap { pin in
            subjects.first { $0.key == pin.id }
                ?? RecentSubject(key: pin.id, title: pin.label, pile: nil, work: nil,
                                 kind: nil, minutes: nil, lastDate: nil)
        }
        .filter(matchesFilter)
    }

    private func kindRows(_ kind: String) -> [RecentSubject] {
        subjects.filter { $0.kind == kind && !isStarred($0) }.filter(matchesFilter)
    }

    private var otherRows: [RecentSubject] {
        subjects.filter { $0.kind != "reading" && $0.kind != "writing" && !isStarred($0) }
            .filter(matchesFilter)
    }

    private func isStarred(_ s: RecentSubject) -> Bool {
        state.pins.contains { $0.type == "time" && $0.id == s.key }
    }

    private func matchesFilter(_ s: RecentSubject) -> Bool {
        let q = filter.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty || subjectLabel(s).lowercased().contains(q)
    }

    private func subjectLabel(_ s: RecentSubject) -> String {
        s.pile?.name ?? s.work?.name ?? s.title ?? s.key
    }

    @ViewBuilder
    private func recentGroup(_ title: String, rows: [RecentSubject]) -> some View {
        if !rows.isEmpty {
            DSLabel(text: title)
            ForEach(rows.prefix(6), id: \.key) { s in
                Button {
                    startRecent(s)
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "play.circle.fill")
                            .font(DS.ui(15))
                            .foregroundStyle(DS.accent)
                        Text(subjectLabel(s))
                            .font(DS.serif(13.5))
                            .foregroundStyle(DS.ink)
                            .lineLimit(1)
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
                .help(state.timerIsRunning ? "Log current timer and start this one" : "Start timer")
            }
        }
    }

    private func startRecent(_ s: RecentSubject) {
        let kind = s.kind ?? state.timerKind
        if state.timerIsRunning {
            // Switching subjects logs the running timer first.
            Task {
                await state.stopAndLogTimer()
                state.startTimer(key: s.key, kind: kind)
            }
        } else {
            state.startTimer(key: s.key, kind: kind)
        }
    }

    private var subjectName: String {
        guard let key = state.timerSubjectKey else { return "" }
        if key.hasPrefix("title:") { return String(key.dropFirst(6)) }
        return key
    }
}
#endif
