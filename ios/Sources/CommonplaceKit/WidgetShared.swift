import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

// Sharing between the app and its widget extension: the App Group
// suite carries a small snapshot (server, session cookie, recents,
// running timer) so widgets can show and start timers without the
// app's in-memory state.
public enum WidgetSharing {
    public static let appGroup = "group.com.commonplacejv.app"
    public static let snapshotKey = "timer_widget_snapshot_v1"

    public static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroup)
    }
}

/// One startable subject in the widget (a recent or starred timer).
public struct WidgetRecent: Codable, Sendable, Hashable {
    public var key: String
    public var label: String
    public var kind: String

    public init(key: String, label: String, kind: String) {
        self.key = key
        self.label = label
        self.kind = kind
    }
}

/// Everything the widgets need, written by the app, read by the
/// extension. `jwt` is the session cookie for the user's own server —
/// stored only in the App Group on their device so widget intents can
/// call the same API the app calls.
public struct TimerWidgetSnapshot: Codable, Sendable {
    public var serverURL: String
    public var jwt: String?
    public var recents: [WidgetRecent]
    public var runningKey: String?
    public var runningLabel: String?
    public var runningKind: String?
    public var runningStartedAt: String?

    public init(serverURL: String, jwt: String? = nil, recents: [WidgetRecent] = [],
                runningKey: String? = nil, runningLabel: String? = nil,
                runningKind: String? = nil, runningStartedAt: String? = nil) {
        self.serverURL = serverURL
        self.jwt = jwt
        self.recents = recents
        self.runningKey = runningKey
        self.runningLabel = runningLabel
        self.runningKind = runningKind
        self.runningStartedAt = runningStartedAt
    }

    public static func load() -> TimerWidgetSnapshot? {
        guard let data = WidgetSharing.defaults?.data(forKey: WidgetSharing.snapshotKey)
        else { return nil }
        return try? JSONDecoder().decode(TimerWidgetSnapshot.self, from: data)
    }

    public func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        WidgetSharing.defaults?.set(data, forKey: WidgetSharing.snapshotKey)
    }
}

#if os(iOS)
/// Live Activity for the running timer: started by the app when a
/// timer starts, ended when it stops. Elapsed time is computed from
/// `startedAt` at render time, so the lock screen ticks without any
/// updates from the app.
@available(iOS 16.2, *)
public struct TimerActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var kind: String
        public var label: String

        public init(kind: String, label: String) {
            self.kind = kind
            self.label = label
        }
    }

    public var startedAt: Date

    public init(startedAt: Date) {
        self.startedAt = startedAt
    }
}
#endif
