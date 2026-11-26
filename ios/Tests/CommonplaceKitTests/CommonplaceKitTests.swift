import XCTest
@testable import CommonplaceKit

final class TimeFormattingTests: XCTestCase {
    func testFormatMinutes() {
        XCTAssertEqual(formatMinutes(0), "0m")
        XCTAssertEqual(formatMinutes(5), "5m")
        XCTAssertEqual(formatMinutes(59), "59m")
        XCTAssertEqual(formatMinutes(60), "1h")
        XCTAssertEqual(formatMinutes(75), "1h 15m")
        XCTAssertEqual(formatMinutes(120), "2h")
    }

    func testFormatElapsed() {
        XCTAssertEqual(formatElapsed(0), "0:00")
        XCTAssertEqual(formatElapsed(5_000), "0:05")
        XCTAssertEqual(formatElapsed(65_000), "1:05")
        XCTAssertEqual(formatElapsed(3_661_000), "1:01:01")
        XCTAssertEqual(formatElapsed(-1_000), "0:00")
    }

    func testDayStringAndParseDay() {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(identifier: "UTC")
        components.year = 2026
        components.month = 11
        components.day = 25
        let date = components.date!
        XCTAssertEqual(dayString(date), "2026-11-25")
        XCTAssertEqual(parseDay("2026-11-25"), components.date)
        XCTAssertNil(parseDay("2026-11-5"))
        XCTAssertNil(parseDay("not-a-date"))
        XCTAssertNil(parseDay("2026/11/25"))
    }

    func testShiftDay() {
        XCTAssertEqual(shiftDay("2026-11-25", by: 1), "2026-11-26")
        XCTAssertEqual(shiftDay("2026-11-25", by: -1), "2026-11-24")
        XCTAssertEqual(shiftDay("2026-12-31", by: 1), "2027-01-01")
        XCTAssertEqual(shiftDay("2026-11-25", by: 0), "2026-11-25")
        XCTAssertNil(shiftDay("bogus", by: 1))
    }

    func testWeekRangeMidweek() {
        // 2026-11-25 is a Wednesday; Monday-start week is 11-23..11-29.
        let wednesday = parseDay("2026-11-25")!
        let (start, end) = weekRange(containing: wednesday)
        XCTAssertEqual(dayString(start), "2026-11-23")
        XCTAssertEqual(dayString(end), "2026-11-30")
        XCTAssertEqual(weekDayStrings(containing: wednesday),
                      ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26",
                       "2026-11-27", "2026-11-28", "2026-11-29"])
    }

    func testWeekRangeOnSunday() {
        // 2026-11-29 is a Sunday: still in the week starting Monday 11-23.
        let sunday = parseDay("2026-11-29")!
        let (start, end) = weekRange(containing: sunday)
        XCTAssertEqual(dayString(start), "2026-11-23")
        XCTAssertEqual(dayString(end), "2026-11-30")
    }

    func testWeekRangeOnMonday() {
        let monday = parseDay("2026-11-23")!
        let (start, end) = weekRange(containing: monday)
        XCTAssertEqual(dayString(start), "2026-11-23")
        XCTAssertEqual(dayString(end), "2026-11-30")
    }
}

final class SubjectKeyTests: XCTestCase {
    func testPileKey() {
        XCTAssertEqual(TimeSubjectKey.pileKey(pileId: "abc123"),
                       "pile:abc123")
    }

    func testTitleKeyLowercasesAndTrims() {
        XCTAssertEqual(TimeSubjectKey.titleKey(title: "  Deep Work "),
                       "title:deep work")
    }

    func testParseRoundTrip() {
        XCTAssertEqual(TimeSubjectKey.parse("pile:abc123"),
                       .pile(id: "abc123"))
        XCTAssertEqual(TimeSubjectKey.parse("title:deep work"),
                       .title(slug: "deep work"))
        XCTAssertNil(TimeSubjectKey.parse("pile:"))
        XCTAssertNil(TimeSubjectKey.parse("title:"))
        XCTAssertNil(TimeSubjectKey.parse("other:xyz"))
        XCTAssertNil(TimeSubjectKey.parse(""))
    }
}

final class NoteStatusDecodingTests: XCTestCase {
    func testNoteReviewFieldsDecodeTolerantly() throws {
        let json = """
        {"_id":"n1","title":"T","reviewedAt":"2026-11-20T10:00:00Z","reviewDueAt":"2026-11-27T10:00:00Z","lastOpenedAt":"2026-11-24T10:00:00Z","titleSource":"ai","embeddingHash":"abc","embeddingStale":true,"people":[{"_id":"a1","name":"Ada"}]}
        """
        let note = try APIClient.makeDecoder().decode(Note.self, from: Data(json.utf8))
        XCTAssertEqual(note.titleSource, "ai")
        XCTAssertEqual(note.embeddingHash, "abc")
        XCTAssertEqual(note.embeddingStale, true)
        XCTAssertNotNil(note.reviewedAt)
        XCTAssertNotNil(note.reviewDueAt)
        XCTAssertEqual(note.people?.first?.name, "Ada")
    }

    func testLocalDayStringRoundTrips() {
        let s = localDayString(Date())
        XCTAssertEqual(s.count, 10)
        XCTAssertNotNil(parseDay(s))
    }

    func testWorkEntityFieldsDecode() throws {
        let json = """
        {"_id":"w1","name":"W","summary":"S","citation_information":"C","editors":[{"_id":"a1","name":"Ed"}],"translators":[]}
        """
        let work = try APIClient.makeDecoder().decode(Work.self, from: Data(json.utf8))
        XCTAssertEqual(work.summary, "S")
        XCTAssertEqual(work.editors?.first?.name, "Ed")
    }
}

final class TimerStateTests: XCTestCase {
    func testStartStopRoundTrip() {
        var timer = TimerState()
        XCTAssertFalse(timer.isRunning)
        let start = Date(timeIntervalSince1970: 1_000_000)
        timer.start(subjectKey: "title:deep work", kind: "writing", at: start)
        XCTAssertTrue(timer.isRunning)
        XCTAssertEqual(timer.elapsed(at: start.addingTimeInterval(90)), 90)
        // 90s rounds to nearest minute: 2.
        XCTAssertEqual(timer.stop(at: start.addingTimeInterval(90)), 2)
        XCTAssertFalse(timer.isRunning)
    }

    func testMinimumOneMinute() {
        var timer = TimerState()
        let start = Date(timeIntervalSince1970: 2_000_000)
        timer.start(subjectKey: "pile:abc", kind: "reading", at: start)
        // 5 seconds still logs 1 minute.
        XCTAssertEqual(timer.minutesToLog(at: start.addingTimeInterval(5)), 1)
        XCTAssertEqual(timer.stop(at: start.addingTimeInterval(5)), 1)
    }

    func testRoundingToNearest() {
        var timer = TimerState()
        let start = Date(timeIntervalSince1970: 3_000_000)
        timer.start(subjectKey: "title:x", kind: "reading", at: start)
        // 29s -> 0.48min -> rounds to 0 -> clamped to 1.
        XCTAssertEqual(timer.minutesToLog(at: start.addingTimeInterval(29)), 1)
        // 31s -> 0.52min -> rounds to 1.
        XCTAssertEqual(timer.minutesToLog(at: start.addingTimeInterval(31)), 1)
        // 89s -> 1.48min -> 1; 91s -> 1.52min -> 2.
        XCTAssertEqual(timer.minutesToLog(at: start.addingTimeInterval(89)), 1)
        XCTAssertEqual(timer.minutesToLog(at: start.addingTimeInterval(91)), 2)
    }

    func testStopWhenIdleReturnsNil() {
        var timer = TimerState()
        XCTAssertNil(timer.minutesToLog())
        XCTAssertNil(timer.stop())
    }

    func testCancel() {
        var timer = TimerState()
        timer.start(subjectKey: "title:x", kind: "reading")
        timer.cancel()
        XCTAssertFalse(timer.isRunning)
        XCTAssertNil(timer.minutesToLog())
    }
}
