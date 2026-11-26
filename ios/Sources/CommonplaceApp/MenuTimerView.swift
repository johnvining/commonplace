import SwiftUI
import CommonplaceKit

#if os(macOS)
/// Menu bar timer: the label always shows the running timer (elapsed +
/// kind) or a plain timer icon when idle. The popover can stop & log it.
struct MenuTimerLabel: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        if let at = state.timerStartedAt {
            TimelineView(.periodic(from: Date(), by: 1)) { ctx in
                Label(
                    formatElapsed(ctx.date.timeIntervalSince(at) * 1000) + (state.timerKind == "reading" ? " R" : " W"),
                    systemImage: "timer"
                )
            }
        } else {
            Label("Timer", systemImage: "timer")
        }
    }
}

struct MenuTimerView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let at = state.timerStartedAt {
                TimelineView(.periodic(from: Date(), by: 1)) { ctx in
                    Text(formatElapsed(ctx.date.timeIntervalSince(at) * 1000))
                        .font(DS.ui(22, weight: .semibold))
                        .monospacedDigit()
                }
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
