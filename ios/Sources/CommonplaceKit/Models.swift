import Foundation

// MARK: - Response envelopes

/// Success envelope used by `asyncWrapper` (`server/src/utils/requests.ts`):
/// every JSON success body is `{ data: <payload> }`.
public struct APIEnvelope<T: Decodable>: Decodable {
    public var data: T
}

/// Error body: `{ message: <string> }`.
public struct APIErrorBody: Decodable {
    public var message: String?
}

// MARK: - Shared reference

/// An entity reference that arrives either as a bare id string or as a
/// populated `{ _id, name }` object (note/work/time payloads populate refs).
public struct PopulatedRef: Codable, Equatable, Sendable {
    public var id: String
    public var name: String?

    public init(id: String, name: String? = nil) {
        self.id = id
        self.name = name
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let id = try? container.decode(String.self) {
            self.id = id
            self.name = nil
            return
        }
        struct Obj: Decodable { var _id: String; var name: String? }
        let obj = try container.decode(Obj.self)
        self.id = obj._id
        self.name = obj.name
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(id)
    }
}

// MARK: - Note

/// Wrapper that drops array elements which fail to decode (e.g. null
/// populated refs left behind by deleted entities in old data).
private struct FailableRef: Decodable {
    var value: PopulatedRef?
    init(from decoder: Decoder) throws {
        value = try? PopulatedRef(from: decoder)
    }
}

private func tolerantRefs(_ container: KeyedDecodingContainer<Note.CodingKeys>,
                          _ key: Note.CodingKeys) -> [PopulatedRef]? {
    guard let raw = try? container.decodeIfPresent([FailableRef].self, forKey: key) else { return nil }
    return raw.compactMap(\.value)
}

private func tolerantInt(_ container: KeyedDecodingContainer<Note.CodingKeys>,
                         _ key: Note.CodingKeys) -> Int? {
    if let v = try? container.decodeIfPresent(Int.self, forKey: key) { return v }
    if let v = try? container.decodeIfPresent(Double.self, forKey: key) { return Int(v) }
    if let v = try? container.decodeIfPresent(String.self, forKey: key) { return Int(v) }
    return nil
}

private func tolerantString(_ container: KeyedDecodingContainer<Note.CodingKeys>,
                            _ key: Note.CodingKeys) -> String? {
    if let v = try? container.decodeIfPresent(String.self, forKey: key) { return v }
    if let v = try? container.decodeIfPresent(Int.self, forKey: key) { return String(v) }
    return nil
}

/// A note's populated work, including its authors (the API populates
/// `work.authors` so a note with no authors of its own can inherit
/// them for display, like the web's authorsWithWorkFallback).
public struct WorkRef: Codable, Equatable, Sendable {
    public var id: String
    public var name: String?
    public var authors: [PopulatedRef]?

    public init(id: String, name: String? = nil, authors: [PopulatedRef]? = nil) {
        self.id = id
        self.name = name
        self.authors = authors
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let id = try? container.decode(String.self) {
            self.id = id
            self.name = nil
            self.authors = nil
            return
        }
        struct Obj: Decodable {
            var _id: String
            var name: String?
            var authors: [PopulatedRef]?
        }
        let obj = try container.decode(Obj.self)
        self.id = obj._id
        self.name = obj.name
        self.authors = obj.authors
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(id)
    }
}

public struct Note: Codable, Sendable {
    public var _id: String?
    public var title: String?
    public var text: String?
    public var take: String?
    public var url: String?
    public var year: Int?
    public var page: String?
    public var authors: [PopulatedRef]?
    public var people: [PopulatedRef]?
    public var work: WorkRef?
    public var ideas: [PopulatedRef]?
    public var piles: [PopulatedRef]?
    public var images: [String]?
    public var nick: String?
    public var reviewState: String?
    public var openCount: Int?
    public var reviewCount: Int?
    public var reviewedAt: Date?
    public var reviewDueAt: Date?
    public var lastOpenedAt: Date?
    public var titleSource: String?
    public var embeddingHash: String?
    public var embeddingStale: Bool?

    enum CodingKeys: String, CodingKey {
        case _id, title, text, take, url, year, page, authors, people, work
        case ideas, piles, images, nick, reviewState, openCount, reviewCount
        case createdAt, updatedAt, reviewedAt, reviewDueAt, lastOpenedAt
        case titleSource, embeddingHash, embeddingStale
    }

    public init() {}

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        _id = try? c.decodeIfPresent(String.self, forKey: ._id)
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        text = try? c.decodeIfPresent(String.self, forKey: .text)
        take = try? c.decodeIfPresent(String.self, forKey: .take)
        url = tolerantString(c, .url)
        year = tolerantInt(c, .year)
        page = tolerantString(c, .page)
        authors = tolerantRefs(c, .authors)
        people = tolerantRefs(c, .people)
        work = try? c.decodeIfPresent(WorkRef.self, forKey: .work)
        ideas = tolerantRefs(c, .ideas)
        piles = tolerantRefs(c, .piles)
        images = (try? c.decodeIfPresent([String].self, forKey: .images)) ?? nil
        nick = try? c.decodeIfPresent(String.self, forKey: .nick)
        reviewState = try? c.decodeIfPresent(String.self, forKey: .reviewState)
        openCount = tolerantInt(c, .openCount)
        reviewCount = tolerantInt(c, .reviewCount)
        reviewedAt = try? c.decodeIfPresent(Date.self, forKey: .reviewedAt)
        reviewDueAt = try? c.decodeIfPresent(Date.self, forKey: .reviewDueAt)
        lastOpenedAt = try? c.decodeIfPresent(Date.self, forKey: .lastOpenedAt)
        titleSource = try? c.decodeIfPresent(String.self, forKey: .titleSource)
        embeddingHash = try? c.decodeIfPresent(String.self, forKey: .embeddingHash)
        embeddingStale = try? c.decodeIfPresent(Bool.self, forKey: .embeddingStale)
        createdAt = try? c.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try? c.decodeIfPresent(Date.self, forKey: .updatedAt)
    }
    public var createdAt: Date?
    public var updatedAt: Date?
}

public struct NoteUpdate: Codable, Sendable {
    public var title: String?
    public var text: String?
    public var take: String?
    public var url: String?
    public var year: Int?
    public var page: String?
    /// Author ids — the web edits note authors through the note update.
    public var authors: [String]?
    /// People (about) ids — saved through the same note update as authors.
    public var people: [String]?

    public init(title: String? = nil, text: String? = nil, take: String? = nil,
                url: String? = nil, year: Int? = nil, page: String? = nil,
                authors: [String]? = nil, people: [String]? = nil) {
        self.title = title
        self.text = text
        self.take = take
        self.url = url
        self.year = year
        self.page = page
        self.authors = authors
        self.people = people
    }
}

public struct ReviewResult: Codable, Sendable {
    public var reviewedAt: Date?
    public var reviewDueAt: Date?
    public var reviewCount: Int?
    public var reviewState: String?
}

// MARK: - Author / Work / Idea / Pile

public struct Author: Codable, Sendable {
    public var _id: String?
    public var name: String?
    public var usernames: [String]?
    public var birth_year: Int?
    public var death_year: Int?
    public var note_count: Int?
    public var work_count: Int?
    public var createdAt: Date?
    public var updatedAt: Date?
}

public struct Work: Codable, Sendable {
    public var _id: String?
    public var name: String?
    public var url: String?
    public var year: Int?
    public var authors: [PopulatedRef]?
    public var editors: [PopulatedRef]?
    public var translators: [PopulatedRef]?
    public var piles: [PopulatedRef]?
    public var ideas: [PopulatedRef]?
    public var note_count: Int?
    public var summary: String?
    public var citation_information: String?
    public var createdAt: Date?
    public var updatedAt: Date?
}

public struct Idea: Codable, Sendable {
    public var _id: String?
    public var name: String?
    public var text: String?
    public var note_count: Int?
    public var start_year: Int?
    public var end_year: Int?
    public var person: Bool?
    public var createdAt: Date?
    public var updatedAt: Date?
}

public struct Pile: Codable, Sendable {
    public var _id: String?
    public var name: String?
    public var note_count: Int?
    public var work_count: Int?
    public var start_year: Int?
    public var end_year: Int?
    public var createdAt: Date?
    public var updatedAt: Date?

    public init() {}
}

// MARK: - Nick

/// `GET /api/nick/:nick` returns null or one of: an active entity nick, an
/// alias (`state` + `mergedFrom`), or a retired nick (`retired: true`).
public struct NickLookup: Codable, Sendable {
    public var key: String?
    public var state: String?
    public var note: String?
    public var work: String?
    public var idea: String?
    public var pile: String?
    public var auth: String?
    public var mergedFrom: String?
    public var retired: Bool?
    public var name: String?
    public var retiredAt: Date?
}

public struct NickKey: Codable, Sendable {
    public var key: String?
}

// MARK: - Pin

/// Wire shape used by the site: `{ type, id, label, href, pinnedAt(ms) }`
/// (`server/src/resources/pin/pin.controllers.ts` `toItem`).
public struct PinItem: Codable, Sendable {
    public var type: String
    public var id: String
    public var label: String?
    public var href: String?
    public var pinnedAt: Double?
    /// Local-only: queued but not yet confirmed by the server.
    public var pending: Bool?

    public init(type: String, id: String, label: String? = nil,
                href: String? = nil, pinnedAt: Double? = nil, pending: Bool? = nil) {
        self.type = type
        self.id = id
        self.label = label
        self.href = href
        self.pinnedAt = pinnedAt
        self.pending = pending
    }
}

public struct PinSyncOp: Codable, Sendable {
    public var op: String // "pin" | "unpin"
    public var type: String
    public var id: String
    public var label: String?
    public var href: String?
    public var at: Double?

    public init(op: String, type: String, id: String, label: String? = nil,
                href: String? = nil, at: Double? = nil) {
        self.op = op
        self.type = type
        self.id = id
        self.label = label
        self.href = href
        self.at = at
    }
}

// MARK: - Link

public struct Link: Codable, Sendable {
    public var _id: String?
    public var left_note: String?
    public var right_note: String?
}

// MARK: - Stats

public struct StatsCounts: Codable, Sendable {
    public var notes: Int?
    public var authors: Int?
    public var ideas: Int?
    public var works: Int?
    public var piles: Int?
}

public struct StatsResponse: Codable, Sendable {
    public var success: Bool?
    public var data: StatsCounts?
}

// MARK: - Search

/// Wire shape: `{ type, item: { _id, title?, name?, … }, score }`.
public struct UnifiedSearchItem: Codable, Sendable {
    public var type: String?
    public var score: Double?
    public var item: Item?

    public struct Item: Codable, Sendable {
        public var _id: String?
        public var title: String?
        public var name: String?
        public var text: String?
        public var take: String?
    }

    public var itemId: String? { item?._id }
    public var displayName: String { item?.title ?? item?.name ?? "(unnamed)" }
}

// MARK: - Time

public struct TimeEntry: Codable, Sendable {
    public var _id: String?
    public var title: String?
    public var pile: PopulatedRef?
    public var work: PopulatedRef?
    public var startedAt: Date?
    public var endedAt: Date?
    public var kind: String?
    public var minutes: Int?
    public var date: Date?
    public var notes: String?
    public var createdAt: Date?
    public var updatedAt: Date?
}

public struct TimeEntryBody: Codable, Sendable {
    public var title: String?
    public var pile: String?
    public var work: String?
    public var pileIsNull: Bool
    public var kind: String?
    public var minutes: Int?
    public var date: String?
    public var startedAt: String?
    public var endedAt: String?
    public var notes: String?

    public init(title: String? = nil, pile: String? = nil, work: String? = nil, pileIsNull: Bool = false,
                kind: String? = nil, minutes: Int? = nil, date: String? = nil,
                startedAt: String? = nil, endedAt: String? = nil,
                notes: String? = nil) {
        self.title = title
        self.pile = pile
        self.work = work
        self.pileIsNull = pileIsNull
        self.kind = kind
        self.minutes = minutes
        self.date = date
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.notes = notes
    }

    enum CodingKeys: String, CodingKey {
        case title, pile, work, kind, minutes, date, startedAt, endedAt, notes
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        work = try c.decodeIfPresent(String.self, forKey: .work)
        minutes = try c.decodeIfPresent(Int.self, forKey: .minutes)
        kind = try c.decodeIfPresent(String.self, forKey: .kind)
        date = try c.decodeIfPresent(String.self, forKey: .date)
        startedAt = try c.decodeIfPresent(String.self, forKey: .startedAt)
        endedAt = try c.decodeIfPresent(String.self, forKey: .endedAt)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        if let p = try? c.decodeIfPresent(String.self, forKey: .pile) {
            pile = p
        } else {
            pile = nil
        }
        pileIsNull = false
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        if pileIsNull {
            try c.encodeNil(forKey: .pile)
        } else {
            try c.encodeIfPresent(pile, forKey: .pile)
        }
        try c.encodeIfPresent(work, forKey: .work)
        try c.encodeIfPresent(kind, forKey: .kind)
        try c.encodeIfPresent(minutes, forKey: .minutes)
        try c.encodeIfPresent(date, forKey: .date)
        try c.encodeIfPresent(startedAt, forKey: .startedAt)
        try c.encodeIfPresent(endedAt, forKey: .endedAt)
        try c.encodeIfPresent(notes, forKey: .notes)
    }
}

public struct SubjectRow: Codable, Sendable {
    public var minutes: Int?
    public var readingMinutes: Int?
    public var writingMinutes: Int?
    public var entryCount: Int?
}

public struct PileSubjectRow: Codable, Sendable {
    public var pile: String?
    public var name: String?
    public var minutes: Int?
    public var readingMinutes: Int?
    public var writingMinutes: Int?
    public var entryCount: Int?
}

public struct TitleSubjectRow: Codable, Sendable {
    public var title: String?
    public var minutes: Int?
    public var readingMinutes: Int?
    public var writingMinutes: Int?
    public var entryCount: Int?
}

public struct WorkSubjectRow: Codable, Sendable {
    public var work: String?
    public var name: String?
    public var minutes: Int?
    public var readingMinutes: Int?
    public var writingMinutes: Int?
    public var entryCount: Int?
}

public struct DaySummary: Codable, Sendable {
    public var date: String?
    public var totalMinutes: Int?
    public var readingMinutes: Int?
    public var writingMinutes: Int?
    public var entryCount: Int?
    public var byPile: [PileSubjectRow]?
    public var byWork: [WorkSubjectRow]?
    public var byTitle: [TitleSubjectRow]?
}

public struct WeeklySummary: Codable, Sendable {
    public var weekStart: String?
    public var weekEnd: String?
    public var totalMinutes: Int?
    public var readingMinutes: Int?
    public var writingMinutes: Int?
    public var entryCount: Int?
    public var byPile: [PileSubjectRow]?
    public var byWork: [WorkSubjectRow]?
    public var byTitle: [TitleSubjectRow]?
    public var byDay: [DaySummary]?
}

/// One analysis scope (last 7 days / this month) from the summary API.
public struct ScopeSummary: Codable, Sendable {
    public var start: String?
    public var end: String?
    public var totalMinutes: Int?
    public var readingMinutes: Int?
    public var writingMinutes: Int?
    public var entryCount: Int?
    public var byPile: [PileSubjectRow]?
    public var byWork: [WorkSubjectRow]?
    public var byTitle: [TitleSubjectRow]?
    public var byDay: [DaySummary]?
}

public struct TimeSummary: Codable, Sendable {
    public var daily: DaySummary?
    public var weekly: WeeklySummary?
    public var last7: ScopeSummary?
    public var monthly: ScopeSummary?
}

public struct RecentSubjectPile: Codable, Sendable {
    public var id: String?
    public var name: String?
}

public struct RecentSubject: Codable, Sendable {
    public var key: String
    public var title: String?
    public var pile: RecentSubjectPile?
    public var work: RecentSubjectPile?
    public var kind: String?
    public var minutes: Int?
    public var lastDate: String?
}

public struct TimeImportRow: Codable, Sendable {
    public var row: Int?
    public var ok: Bool?
    public var error: String?
    public var id: String?
}

public struct TimeImportResult: Codable, Sendable {
    public var imported: Int?
    public var failed: Int?
    public var rows: [TimeImportRow]?
}

// MARK: - Maintenance

public struct MaintenanceItem: Codable, Sendable {
    public var id: String?
    public var title: String?
    public var issue: String?
    public var description: String?
    public var pending: Bool?
}

public struct MaintenanceJobRef: Codable, Sendable {
    public var jobId: String?
}

public struct MaintenanceJob: Codable, Sendable {
    public var status: String?
    public var dryRun: Bool?
    public var output: [String]?
}
