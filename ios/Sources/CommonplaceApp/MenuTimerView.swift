import SwiftUI
import CommonplaceKit

#if os(macOS)
/// Menu bar timer: the label always shows the running timer (elapsed +
/// kind) or a plain timer icon when idle. The popover can stop & log it.
struct MenuTimerLabel: View {
    @EnvironmentObject var state: AppState
    @State private var now = Date()

    // No TimelineView here: inside a MenuBarExtra label it re-invalidates
    // the host's status button in a tight loop at launch (app hangs at
    // 100% CPU resolving the symbol image). A 1s timer publisher ticks
    // the elapsed text without that feedback cycle.
    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if let at = state.timerStartedAt {
                Label(
                    formatElapsed(now.timeIntervalSince(at) * 1000) + (state.timerKind == "reading" ? " R" : " W"),
                    systemImage: "timer"
                )
            } else {
                Label("Timer", systemImage: "timer")
            }
        }
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
                Text("\(state.timerKind.capitalized) · \(subjectName)")
                    .font(DS.ui(12)).foregroundStyle(DS.muted)
                Button("Stop & log") {
                    Task { await state.stopAndLogTimer() }
                }
                Button("Discard timer", role: .destructive) {
                    state.clearTimer()
                }
            } else {
                Text("No timer running.").font(DS.ui(13)).foregroundStyle(DS.muted)
                Text("Start one from the Time section.").font(DS.ui(11)).foregroundStyle(DS.muted)
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
