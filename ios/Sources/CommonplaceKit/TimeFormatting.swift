import Foundation

// MARK: - Time display & UTC day helpers
//
// Mirrors `site/Time.tsx` (`formatMinutes`, `formatElapsed`, `shiftDay`,
// `subjectKeyFor`) and the server's UTC day semantics
// (`server/src/resources/time/time.controllers.ts`: `dayString`, `parseDay`,
// `weekRange` — Monday–Sunday week containing the day, UTC).

private let utcCalendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    return calendar
}()

private func utcDateFormatter() -> DateFormatter {
    let formatter = DateFormatter()
    formatter.calendar = utcCalendar
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    return formatter
}

/// `75` → `"1h 15m"`, `60` → `"1h"`, `5` → `"5m"` (site/Time.tsx formatMinutes).
public func formatMinutes(_ minutes: Int) -> String {
    let hours = minutes / 60
    let rest = minutes % 60
    if hours <= 0 { return "\(rest)m" }
    if rest == 0 { return "\(hours)h" }
    return "\(hours)h \(rest)m"
}

/// Live timer readout: `65_000` → `"1:05"`, `3_661_000` → `"1:01:01"`.
public func formatElapsed(_ ms: Double) -> String {
    let totalSeconds = max(0, Int(ms / 1000))
    let hours = totalSeconds / 3600
    let minutes = (totalSeconds % 3600) / 60
    let seconds = totalSeconds % 60
    let pad = { (n: Int) -> String in n < 10 ? "0\(n)" : "\(n)" }
    if hours > 0 { return "\(hours):\(pad(minutes)):\(pad(seconds))" }
    return "\(minutes):\(pad(seconds))"
}

/// The UTC-midnight-normalized `YYYY-MM-DD` string for a date.
public func dayString(_ date: Date) -> String {
    utcDateFormatter().string(from: date)
}

/// Parse a `YYYY-MM-DD` day to its UTC midnight, or nil when unparseable.
public func parseDay(_ value: String) -> Date? {
    guard value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else {
        return nil
    }
    return utcDateFormatter().date(from: value)
}

/// Shift a `YYYY-MM-DD` day by `delta` days (site/Time.tsx `shiftDay`).
/// Returns nil for an unparseable input.
public func shiftDay(_ date: String, by delta: Int) -> String? {
    guard let day = parseDay(date) else { return nil }
    // Noon-anchored like the web client (`T12:00:00`) so DST edges cannot
    // push the result onto the wrong day; output is the UTC calendar day.
    let noon = day.addingTimeInterval(12 * 3600)
    guard let shifted = utcCalendar.date(byAdding: .day, value: delta, to: noon) else { return nil }
    return dayString(shifted)
}

/// Monday–Sunday UTC week containing `day`: `(weekStart, weekEndExclusive)`,
/// both at UTC midnight. Mirrors the server's `weekRange`.
public func weekRange(containing day: Date) -> (start: Date, end: Date) {
    let midnight = utcCalendar.startOfDay(for: day)
    // Sunday = 1 … Saturday = 7; Monday starts the week.
    let weekday = utcCalendar.component(.weekday, from: midnight)
    let offset = (weekday + 5) % 7
    let start = utcCalendar.date(byAdding: .day, value: -offset, to: midnight)!
    let end = utcCalendar.date(byAdding: .day, value: 7, to: start)!
    return (start, end)
}

/// `YYYY-MM-DD` strings for the Monday–Sunday UTC week containing `day`.
public func weekDayStrings(containing day: Date) -> [String] {
    let (start, _) = weekRange(containing: day)
    return (0..<7).map { dayString(utcCalendar.date(byAdding: .day, value: $0, to: start)!) }
}

// MARK: - Time subject keys

/// Starred time subjects are pins of type `time` whose id is the subject key:
/// `pile:<pileId>` for pile-linked time, `title:<lowercased title>` otherwise.
public enum TimeSubjectKey: Equatable, Sendable {
    case pile(id: String)
    case title(slug: String)

    public var key: String {
        switch self {
        case .pile(let id): return "pile:\(id)"
        case .title(let slug): return "title:\(slug)"
        }
    }

    public static func pileKey(pileId: String) -> String {
        "pile:\(pileId)"
    }

    public static func titleKey(title: String) -> String {
        "title:\(title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
    }

    /// Split a stored key back into its subject. Returns nil for malformed keys.
    public static func parse(_ key: String) -> TimeSubjectKey? {
        if key.hasPrefix("pile:") {
            let id = String(key.dropFirst(5))
            guard !id.isEmpty else { return nil }
            return .pile(id: id)
        }
        if key.hasPrefix("title:") {
            let slug = String(key.dropFirst(6))
            guard !slug.isEmpty else { return nil }
            return .title(slug: slug)
        }
        return nil
    }
}
