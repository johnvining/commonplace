import Foundation

// MARK: - Testable timer state machine
//
// Mirrors the `site/Time.tsx` timer: Start records a subject + kind +
// timestamp (persisted by the web client in `time_timer_v1`), Stop logs the
// elapsed time to today. Rounding matches the web client exactly:
// `Math.max(1, Math.round((Date.now() - timerStartedAt) / 60000))` —
// nearest-minute, minimum one minute. No UI, no persistence here; the host
// app owns storage.

public struct TimerState: Equatable, Sendable {
    public var subjectKey: String?
    public var kind: String
    public var startedAt: Date?

    public init(subjectKey: String? = nil, kind: String = "reading",
                startedAt: Date? = nil) {
        self.subjectKey = subjectKey
        self.kind = kind
        self.startedAt = startedAt
    }

    public var isRunning: Bool { startedAt != nil }

    public mutating func start(subjectKey: String, kind: String, at date: Date = Date()) {
        self.subjectKey = subjectKey
        self.kind = kind
        self.startedAt = date
    }

    /// Elapsed seconds at `date` (nil when stopped).
    public func elapsed(at date: Date = Date()) -> TimeInterval? {
        guard let startedAt else { return nil }
        return max(0, date.timeIntervalSince(startedAt))
    }

    /// Whole minutes to log for a stop at `date`: nearest minute, minimum 1.
    public func minutesToLog(at date: Date = Date()) -> Int? {
        guard let elapsed = elapsed(at: date) else { return nil }
        return max(1, Int((elapsed / 60).rounded()))
    }

    /// Stop the timer, returning the minutes to log (nil when not running).
    @discardableResult
    public mutating func stop(at date: Date = Date()) -> Int? {
        guard let minutes = minutesToLog(at: date) else { return nil }
        startedAt = nil
        return minutes
    }

    public mutating func cancel() {
        startedAt = nil
    }
}
