import SwiftUI
import WidgetKit
import AppIntents
import CommonplaceKit

@main
struct CommonplaceWidgets: WidgetBundle {
    var body: some Widget {
        TimerHomeWidget()
        TimerLiveActivityWidget()
    }
}

// MARK: - Start timer intent

/// Starts a timer from the widget: calls the shared timer API with
/// the session the app stored in the App Group, then refreshes the
/// snapshot so every surface (and this widget) shows it running.
struct StartTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Timer"
    static var description = IntentDescription("Start a Commonplace timer for a recent subject.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Subject key") var key: String
    @Parameter(title: "Label") var label: String
    @Parameter(title: "Kind") var kind: String

    init() {}
    init(key: String, label: String, kind: String) {
        self.key = key
        self.label = label
        self.kind = kind
    }

    func perform() async throws -> some IntentResult {
        guard var snap = TimerWidgetSnapshot.load(),
              let jwt = snap.jwt,
              let base = URL(string: snap.serverURL) else {
            return .result()
        }
        let started = Date()
        let iso = ISO8601DateFormatter().string(from: started)
        var req = URLRequest(url: base.appendingPathComponent("time/timer"))
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("XMLHttpRequest", forHTTPHeaderField: "X-Requested-With")
        req.setValue("jwt=\(jwt)", forHTTPHeaderField: "Cookie")
        req.httpBody = try JSONEncoder().encode(
            RunningTimerState(key: key, kind: kind, label: label, startedAt: iso))
        _ = try? await URLSession.shared.data(for: req)
        snap.runningKey = key
        snap.runningLabel = label
        snap.runningKind = kind
        snap.runningStartedAt = iso
        snap.save()
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Home-screen widget

struct TimerEntry: TimelineEntry {
    let date: Date
    let snapshot: TimerWidgetSnapshot?
}

struct TimerProvider: TimelineProvider {
    func placeholder(in context: Context) -> TimerEntry {
        TimerEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (TimerEntry) -> Void) {
        completion(TimerEntry(date: Date(), snapshot: TimerWidgetSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TimerEntry>) -> Void) {
        let entry = TimerEntry(date: Date(), snapshot: TimerWidgetSnapshot.load())
        // While a timer runs, refresh each minute (elapsed is rendered
        // from the start date, so this is just belt and braces).
        let next = Calendar.current.date(byAdding: .minute, value: 1, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct TimerWidgetView: View {
    let entry: TimerEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Text("C").font(.custom("Georgia", size: 14).weight(.bold))
                Text("Commonplace").font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary)
            }
            if let snap = entry.snapshot, let startedISO = snap.runningStartedAt,
               let started = ISO8601DateFormatter().date(from: startedISO) {
                Text(snap.runningKind == "reading" ? "READING" : "WRITING")
                    .font(.system(size: 9, weight: .semibold)).tracking(0.7).foregroundStyle(.secondary)
                Text(snap.runningLabel ?? snap.runningKey ?? "")
                    .font(.system(.body, design: .serif).weight(.semibold))
                    .lineLimit(1)
                Text(started, style: .timer)
                    .font(.system(size: 20, weight: .semibold)).monospacedDigit()
            } else if let snap = entry.snapshot, !snap.recents.isEmpty {
                ForEach(snap.recents.prefix(4), id: \.key) { recent in
                    Button(intent: StartTimerIntent(key: recent.key, label: recent.label, kind: recent.kind)) {
                        HStack(spacing: 6) {
                            Image(systemName: "play.circle.fill").foregroundStyle(.tint)
                            Text(recent.label)
                                .font(.system(.footnote, design: .serif))
                                .lineLimit(1)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Text("Open Commonplace to load your recent timers.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(4)
        .widgetURL(URL(string: "commonplace://time"))
    }
}

struct TimerHomeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TimerHomeWidget", provider: TimerProvider()) { entry in
            TimerWidgetView(entry: entry)
        }
        .configurationDisplayName("Timer")
        .description("See the running timer, or start a recent one.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Live Activity

struct TimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TimerActivityAttributes.self) { context in
            HStack(spacing: 10) {
                Text("C").font(.custom("Georgia", size: 20).weight(.bold))
                VStack(alignment: .leading, spacing: 1) {
                    Text(context.state.kind == "reading" ? "READING" : "WRITING")
                        .font(.system(size: 9, weight: .semibold)).tracking(0.7).foregroundStyle(.secondary)
                    Text(context.state.label)
                        .font(.system(.body, design: .serif).weight(.semibold))
                        .lineLimit(1)
                }
                Spacer()
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 22, weight: .semibold)).monospacedDigit()
                    .frame(maxWidth: 90)
            }
            .padding(14)
            .activityBackgroundTint(Color(red: 0.98, green: 0.95, blue: 0.89))
            .activitySystemActionForegroundColor(.black)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("C").font(.custom("Georgia", size: 15).weight(.bold))
                        Text(context.state.label)
                            .font(.system(.footnote, design: .serif).weight(.semibold))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.startedAt, style: .timer)
                        .font(.system(size: 18, weight: .semibold)).monospacedDigit()
                        .frame(maxWidth: 80)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.kind == "reading" ? "Reading" : "Writing")
                        .font(.caption).foregroundStyle(.secondary)
                }
            } compactLeading: {
                Text("C").font(.custom("Georgia", size: 12).weight(.bold))
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 12, weight: .semibold)).monospacedDigit()
                    .frame(maxWidth: 60)
            } minimal: {
                Text("C").font(.custom("Georgia", size: 11).weight(.bold))
            }
        }
    }
}
