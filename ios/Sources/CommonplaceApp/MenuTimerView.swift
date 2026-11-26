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
        }
        .padding(12)
        .frame(width: 230)
    }

    private var subjectName: String {
        guard let key = state.timerSubjectKey else { return "" }
        if key.hasPrefix("title:") { return String(key.dropFirst(6)) }
        return key
    }
}
#endif
