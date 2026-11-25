#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import Foundation

// MARK: - Errors

/// HTTP failures from the API. The web client (`site/Database.ts`) treats 401
/// as "not authorized — route to login" and suppresses its toasts; 403
/// `Missing X-Requested-With header` means the XHR header was omitted.
public enum APIError: Error, Equatable {
    case unauthorized(message: String?)
    case forbidden(message: String?)
    case notFound(message: String?)
    case clientError(status: Int, message: String?)
    case serverError(status: Int, message: String?)
    case decoding(String)
    case transport(String)
}

// MARK: - Client

/// Async/await URLSession client for the Commonplace API.
///
/// - Sends `X-Requested-With: XMLHttpRequest` on every mutating request
///   (POST/PUT/PATCH/DELETE), required by `requireXhr` for all non-GET/HEAD
///   routes under `/api`.
/// - Session auth is the httpOnly `jwt` cookie set by register/login; the
///   shared `HTTPCookieStorage` persists it automatically, so no manual
///   token handling is needed. Use `validateSession()` (`GET /api/user/me`,
///   200 empty when signed in) to check auth state.
/// - Successful JSON bodies are `{ data: <payload> }` (asyncWrapper); error
///   bodies are `{ message: <string> }`.
public final class APIClient: Sendable {
    public let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - Plumbing

    public static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = withFractional.date(from: string) { return date }
            if let date = plain.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(
                in: container, debugDescription: "Invalid ISO8601 date: \(string)")
        }
        return decoder
    }

    private static func queryItems(_ query: [String: String]) -> [URLQueryItem] {
        query.map { URLQueryItem(name: $0.key, value: $0.value) }
    }

    private func request(path: String, method: String, query: [String: String] = [:],
                         body: (any Encodable)? = nil) throws -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent(path),
                                       resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = Self.queryItems(query) }
        guard let url = components.url else {
            throw APIError.transport("Invalid URL for path: \(path)")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if method != "GET" && method != "HEAD" {
            req.setValue("XMLHttpRequest", forHTTPHeaderField: "X-Requested-With")
        }
        if let body {
            let encoder = JSONEncoder()
            req.httpBody = try encoder.encode(AnyEncodable(body))
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return req
    }

    private func mapError(status: Int, body: Data?) -> APIError {
        let message: String?
        if let body, !body.isEmpty {
            message = try? Self.makeDecoder().decode(APIErrorBody.self, from: body).message
        } else {
            message = nil
        }
        switch status {
        case 401: return .unauthorized(message: message)
        case 403: return .forbidden(message: message)
        case 404: return .notFound(message: message)
        case 400..<500: return .clientError(status: status, message: message)
        default: return .serverError(status: status, message: message)
        }
    }

    private func perform<T: Decodable>(_ req: URLRequest, as type: T.Type = T.self) async throws -> T {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("Non-HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw mapError(status: http.statusCode, body: data)
        }
        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }
        do {
            let envelope = try Self.makeDecoder().decode(APIEnvelope<T>.self, from: data)
            return envelope.data
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }

    private func performEmpty(_ req: URLRequest) async throws {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("Non-HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw mapError(status: http.statusCode, body: data)
        }
    }

    private func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await perform(try request(path: path, method: "GET", query: query))
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B? = nil,
                                                 query: [String: String] = [:]) async throws -> T {
        try await perform(try request(path: path, method: "POST", query: query, body: body))
    }

    private func put<T: Decodable, B: Encodable>(_ path: String, body: B? = nil,
                                                query: [String: String] = [:]) async throws -> T {
        try await perform(try request(path: path, method: "PUT", query: query, body: body))
    }

    private func delete<T: Decodable>(_ path: String) async throws -> T {
        try await perform(try request(path: path, method: "DELETE"))
    }

    private func deleteEmpty(_ path: String) async throws {
        try await performEmpty(try request(path: path, method: "DELETE"))
    }

    // MARK: - Auth (`/api/user`)

    /// User endpoints answer raw `{ message, user: <id> }` (no `{data:}` envelope).
    public struct AuthMessage: Codable {
        public var message: String?
        public var user: String?
    }

    private func performRaw<T: Decodable>(_ req: URLRequest, as type: T.Type = T.self) async throws -> T {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("Non-HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw mapError(status: http.statusCode, body: data)
        }
        do {
            return try Self.makeDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }

    public func register(username: String, password: String) async throws -> AuthMessage {
        try await performRaw(try request(path: "user", method: "PUT",
                                         body: ["username": username, "password": password]))
    }

    public func login(username: String, password: String) async throws -> AuthMessage {
        try await performRaw(try request(path: "user/auth", method: "POST",
                                         body: ["username": username, "password": password]))
    }

    /// Session check: 200 (empty data) when the `jwt` cookie is valid, 401 otherwise.
    public func validateSession() async throws {
        let _: EmptyResponse = try await get("user/me")
    }

    public func logout() async throws {
        let _: EmptyResponse = try await post("user/logout", body: EmptyBody())
    }

    public func logoutEverywhere() async throws {
        let _: EmptyResponse = try await post("user/logout-everywhere", body: EmptyBody())
    }

    public func changePassword(username: String, oldPassword: String,
                               newPassword: String) async throws -> AuthMessage {
        try await performRaw(try request(path: "user/changepass", method: "PUT",
                                         body: ["username": username, "oldPassword": oldPassword, "newPassword": newPassword]))
    }

    // MARK: - Notes (`/api/note`)

    public func createNote(title: String? = nil, work: String? = nil) async throws -> Note {
        var body: [String: String] = [:]
        if let title { body["title"] = title }
        if let work { body["work"] = work }
        return try await post("note", body: body)
    }

    public func findNotes(searchString: String) async throws -> [Note] {
        try await put("note/find", body: ["searchString": searchString])
    }

    public func unifiedSearch(query: String, limit: Int = 20) async throws -> [UnifiedSearchItem] {
        try await post("note/unified-search", body: ["query": query, "limit": String(limit)])
    }

    public func filterNotes(piles: [String] = [], ideas: [String] = [],
                            skip: Int = 0, limit: Int = 40) async throws -> [Note] {
        var q: [String: String] = ["skip": String(skip), "limit": String(limit)]
        if !piles.isEmpty { q["piles"] = piles.joined(separator: ",") }
        if !ideas.isEmpty { q["ideas"] = ideas.joined(separator: ",") }
        return try await get("note/filter", query: q)
    }

    public func recentNotes(page: Int = 1) async throws -> [Note] {
        try await get("note/all/\(page)")
    }

    public func unfiledNotes(page: Int = 1) async throws -> [Note] {
        try await get("note/file/\(page)")
    }

    public func flipDeck(since: String? = nil) async throws -> [Note] {
        var q: [String: String] = [:]
        if let since { q["since"] = since }
        return try await get("note/flip", query: q)
    }

    public func noteByNick(_ nick: String) async throws -> [Note] {
        try await get("note/nick/\(nick)")
    }

    public func note(id: String) async throws -> [Note] {
        try await get("note/\(id)")
    }

    public func updateNote(id: String, _ update: NoteUpdate) async throws -> Note {
        try await put("note/\(id)", body: update)
    }

    public func deleteNote(id: String) async throws {
        try await deleteEmpty("note/\(id)")
    }

    public func addWorkToNote(noteId: String, workId: String) async throws -> Note {
        try await put("note/\(noteId)/work", body: ["newWork": workId])
    }

    public func createWorkForNote(noteId: String, name: String) async throws -> Note {
        try await put("note/\(noteId)/work/create", body: ["newWork": name])
    }

    public func addIdeaToNote(noteId: String, ideaId: String) async throws -> Note {
        try await put("note/\(noteId)/idea", body: ["id": ideaId])
    }

    public func createIdeaForNote(noteId: String, name: String) async throws -> Note {
        try await put("note/\(noteId)/idea/create", body: ["name": name])
    }

    public func removeIdeaFromNote(noteId: String, ideaId: String) async throws -> Note {
        try await delete("note/\(noteId)/idea/\(ideaId)")
    }

    public func addPileToNote(noteId: String, pileId: String) async throws -> Note {
        try await put("note/\(noteId)/pile", body: ["id": pileId])
    }

    public func createPileForNote(noteId: String, name: String) async throws -> Note {
        try await put("note/\(noteId)/pile/create", body: ["name": name])
    }

    public func removePileFromNote(noteId: String, pileId: String) async throws -> Note {
        try await delete("note/\(noteId)/pile/\(pileId)")
    }

    public func reviewNote(id: String, rating: String) async throws -> ReviewResult {
        try await post("note/\(id)/review", body: ["rating": rating])
    }

    public struct OpenCount: Codable, Sendable {
        public var openCount: Int?
    }

    public func recordNoteOpened(id: String) async throws -> OpenCount {
        try await post("note/\(id)/opened", body: EmptyBody())
    }

    public struct TitleSuggestion: Codable { public var suggested_title: String? }
    public struct IdeaSuggestion: Codable { public var suggested_ideas: [String]? }

    public func suggestTitle(noteId: String) async throws -> TitleSuggestion {
        try await get("note/\(noteId)/title/suggest")
    }

    public func suggestIdeas(noteId: String) async throws -> IdeaSuggestion {
        try await get("note/\(noteId)/ideas/suggest")
    }

    // MARK: Images & OCR

    /// Raw bytes of a note's nth image (1-based), session cookie attached.
    public func noteImageData(noteId: String, index: Int) async throws -> Data {
        let req = try request(path: "note/\(noteId)/images/\(index)", method: "GET")
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await session.data(for: req) }
        catch { throw APIError.transport(error.localizedDescription) }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw mapError(status: (response as? HTTPURLResponse)?.statusCode ?? 0, body: data)
        }
        return data
    }

    /// Authorized URL for a note's nth image (for AsyncImage), with the
    /// session cookie stored in the shared cookie storage.
    public func noteImageURL(noteId: String, index: Int) -> URL {
        baseURL.appendingPathComponent("note/\(noteId)/images/\(index)")
    }

    public func uploadNoteImage(noteId: String, data: Data, filename: String = "photo.jpg") async throws {
        var req = try request(path: "note/\(noteId)/image", method: "PUT")
        let boundary = "Boundary-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        let (respData, response): (Data, URLResponse)
        do { (respData, response) = try await session.upload(for: req, from: body) }
        catch { throw APIError.transport(error.localizedDescription) }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw mapError(status: (response as? HTTPURLResponse)?.statusCode ?? 0, body: respData)
        }
    }

    public func deleteNoteImage(noteId: String, filename: String) async throws {
        try await performEmpty(try request(path: "note/\(noteId)/image/", method: "DELETE",
                                           body: ["filename": filename]))
    }

    /// OCR text for all of a note's images ('' when none has text).
    public func ocrText(noteId: String) async throws -> String {
        try await get("note/\(noteId)/ocr")
    }

    public func importNotesForWork(workId: String, notesText: String) async throws {
        let _: EmptyResponse = try await put("note/import/work/\(workId)", body: ["notesText": notesText])
    }

    // MARK: - Authors (`/api/auth`)

    public func createAuthor(name: String) async throws -> Author {
        try await post("auth", body: ["name": name])
    }

    public func autocompleteAuthors(_ string: String) async throws -> [Author] {
        try await post("auth/autocomplete", body: ["string": string])
    }

    public func autocompleteAuthorsWithCounts(_ string: String) async throws -> [Author] {
        try await post("auth/autocomplete/with-counts", body: ["string": string])
    }

    public func author(id: String) async throws -> Author {
        try await get("auth/\(id)")
    }

    public func updateAuthor(id: String, _ author: Author) async throws -> Author {
        try await put("auth/\(id)", body: author)
    }

    public func deleteAuthor(id: String) async throws {
        try await deleteEmpty("auth/\(id)")
    }

    public func authorNotes(id: String, skip: Int = 0, limit: Int = 40) async throws -> [Note] {
        try await get("auth/\(id)/notes",
                      query: ["skip": String(skip), "limit": String(limit)])
    }

    public func authorWorks(id: String) async throws -> [Work] {
        try await get("auth/\(id)/works")
    }

    // MARK: - Works (`/api/work`)

    public func createWork(name: String) async throws -> Work {
        try await post("work", body: ["name": name])
    }

    public func work(id: String) async throws -> Work {
        try await get("work/\(id)")
    }

    public func updateWork(id: String, _ work: Work) async throws -> Work {
        try await put("work/\(id)", body: work)
    }

    public func deleteWork(id: String) async throws {
        try await deleteEmpty("work/\(id)")
    }

    public func autocompleteWorks(_ string: String) async throws -> [Work] {
        try await post("work/autocomplete", body: ["string": string])
    }

    public func workNotes(id: String, skip: Int = 0, limit: Int = 40) async throws -> [Note] {
        try await get("work/\(id)/notes",
                      query: ["skip": String(skip), "limit": String(limit)])
    }

    public func addPileToWork(workId: String, pileId: String) async throws -> Work {
        try await put("work/\(workId)/pile", body: ["id": pileId])
    }

    public func createPileForWork(workId: String, name: String) async throws -> Work {
        try await put("work/\(workId)/pile/create", body: ["name": name])
    }

    public func removePileFromWork(workId: String, pileId: String) async throws -> Work {
        try await delete("work/\(workId)/pile/\(pileId)")
    }

    public func addIdeaToWork(workId: String, ideaId: String) async throws -> Work {
        try await put("work/\(workId)/idea", body: ["id": ideaId])
    }

    public func createIdeaForWork(workId: String, name: String) async throws -> Work {
        try await put("work/\(workId)/idea/create", body: ["name": name])
    }

    public func removeIdeaFromWork(workId: String, ideaId: String) async throws -> Work {
        try await delete("work/\(workId)/idea/\(ideaId)")
    }

    public func recordWorkOpened(id: String) async throws -> OpenCount {
        try await post("work/\(id)/opened", body: EmptyBody())
    }

    // MARK: - Ideas (`/api/idea`)

    public func createIdea(name: String) async throws -> Idea {
        try await post("idea", body: ["name": name])
    }

    public func idea(id: String) async throws -> Idea {
        try await get("idea/\(id)")
    }

    public func updateIdea(id: String, _ idea: Idea) async throws -> Idea {
        try await put("idea/\(id)", body: idea)
    }

    public func deleteIdea(id: String) async throws {
        try await deleteEmpty("idea/\(id)")
    }

    public func autocompleteIdeas(_ string: String) async throws -> [Idea] {
        try await post("idea/autocomplete", body: ["string": string])
    }

    public func ideaNotes(id: String, skip: Int = 0, limit: Int = 40) async throws -> [Note] {
        try await get("idea/\(id)/notes",
                      query: ["skip": String(skip), "limit": String(limit)])
    }

    public func ideaWorks(id: String) async throws -> [Work] {
        try await get("idea/\(id)/works")
    }

    // MARK: - Piles (`/api/pile`)

    public func createPile(name: String) async throws -> Pile {
        try await post("pile", body: ["name": name])
    }

    public func allPiles() async throws -> [Pile] {
        try await get("pile/all")
    }

    public func pile(id: String) async throws -> Pile {
        try await get("pile/\(id)")
    }

    public func updatePile(id: String, _ pile: Pile) async throws -> Pile {
        try await put("pile/\(id)", body: pile)
    }

    public func deletePile(id: String) async throws {
        try await deleteEmpty("pile/\(id)")
    }

    public func autocompletePiles(_ string: String) async throws -> [Pile] {
        try await post("pile/autocomplete", body: ["string": string])
    }

    public func pileNotes(id: String, skip: Int = 0, limit: Int = 40) async throws -> [Note] {
        try await get("pile/\(id)/notes",
                      query: ["skip": String(skip), "limit": String(limit)])
    }

    public func pileWorks(id: String) async throws -> [Work] {
        try await get("pile/\(id)/works")
    }

    // MARK: - Nicks (`/api/nick`)

    /// Fetch-or-mint the display nick for an entity (`PUT` mints when missing).
    public func nickFor(type: String, id: String) async throws -> NickKey {
        try await put("nick/\(type)/\(id)", body: EmptyBody())
    }

    public func nickLookup(_ nick: String) async throws -> NickLookup? {
        try await get("nick/\(nick)")
    }

    // MARK: - Pins (`/api/pin`)

    public func listPins() async throws -> [PinItem] {
        try await get("pin/")
    }

    public func pin(type: String, id: String, label: String? = nil,
                    href: String? = nil) async throws -> PinItem {
        var body: [String: String] = ["type": type, "id": id]
        if let label { body["label"] = label }
        if let href { body["href"] = href }
        return try await put("pin/", body: body)
    }

    public func unpin(type: String, id: String) async throws {
        let _: EmptyResponse = try await delete("pin/\(type)/\(id)")
    }

    /// Last-write-wins cross-device sync (cap 500 server-side).
    public func syncPins(_ ops: [PinSyncOp]) async throws -> [PinItem] {
        try await post("pin/sync", body: ["ops": ops])
    }

    public func importPins(_ items: [PinItem]) async throws -> [PinItem] {
        try await post("pin/import", body: ["items": items])
    }

    // MARK: - Links (`/api/link`)

    public func linkNotes(leftNick: String, rightNick: String) async throws -> Link {
        try await put("link/", body: ["leftNoteNick": leftNick, "rightNoteNick": rightNick])
    }

    public func linkedNotes(noteId: String) async throws -> [Note] {
        try await get("link/note/\(noteId)")
    }

    public func unlinkNotes(a: String, b: String) async throws {
        let _: EmptyResponse = try await delete("link/between/\(a)/\(b)")
    }

    // MARK: - Stats (`/api/stats`)

    // Recent items per type (`GET /api/stats/recent/:type`, envelope-wrapped).
    public func recentAuthors() async throws -> [Author] { try await get("stats/recent/authors") }
    public func recentWorks() async throws -> [Work] { try await get("stats/recent/works") }
    public func recentIdeas() async throws -> [Idea] { try await get("stats/recent/ideas") }
    public func recentPilesList() async throws -> [Pile] { try await get("stats/recent/piles") }

    /// `GET /api/stats` answers `{success, data}` directly (no `{data:}` envelope).
    public func stats() async throws -> StatsCounts {
        let req = try request(path: "stats", method: "GET")
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw mapError(status: (response as? HTTPURLResponse)?.statusCode ?? 0, body: data)
        }
        do {
            let env = try Self.makeDecoder().decode(StatsResponse.self, from: data)
            guard let counts = env.data else { throw APIError.decoding("Missing stats data") }
            return counts
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }

    // MARK: - Time (`/api/time`)

    public func listTimeEntries(from: String? = nil, to: String? = nil, kind: String? = nil,
                                pile: String? = nil, limit: Int = 200) async throws -> [TimeEntry] {
        var q: [String: String] = ["limit": String(limit)]
        if let from { q["from"] = from }
        if let to { q["to"] = to }
        if let kind { q["kind"] = kind }
        if let pile { q["pile"] = pile }
        return try await get("time/", query: q)
    }

    public func createTimeEntry(_ body: TimeEntryBody) async throws -> TimeEntry {
        try await post("time/", body: body)
    }

    public func timeEntry(id: String) async throws -> TimeEntry {
        try await get("time/\(id)")
    }

    public func updateTimeEntry(id: String, _ body: TimeEntryBody) async throws -> TimeEntry {
        try await put("time/\(id)", body: body)
    }

    public func deleteTimeEntry(id: String) async throws {
        try await deleteEmpty("time/\(id)")
    }

    public func timeSummary(date: String? = nil) async throws -> TimeSummary {
        var q: [String: String] = [:]
        if let date { q["date"] = date }
        return try await get("time/summary", query: q)
    }

    public func recentSubjects(limit: Int = 20) async throws -> [RecentSubject] {
        try await get("time/recent-subjects", query: ["limit": String(limit)])
    }

    public func importTimeEntries(_ entries: [TimeEntryBody]) async throws -> TimeImportResult {
        try await post("time/import", body: ["entries": entries])
    }

    // MARK: - Maintenance (`/api/maintenance`)

    public func maintenanceList() async throws -> [MaintenanceItem] {
        try await get("maintenance/")
    }

    public func runMaintenance(id: String, dryRun: Bool = true) async throws -> MaintenanceJobRef {
        try await post("maintenance/\(id)/run", body: ["dryRun": dryRun])
    }

    public func maintenanceJob(id: String) async throws -> MaintenanceJob {
        try await get("maintenance/jobs/\(id)")
    }
}

// MARK: - Helpers

/// Empty JSON body `{}` for POST/PUT endpoints that take no payload.
public struct EmptyBody: Codable {
    public init() {}
    public func encode(to encoder: Encoder) throws {
        _ = encoder.container(keyedBy: NoKeys.self)
    }
    public init(from decoder: Decoder) throws {}
    private enum NoKeys: CodingKey {}
}

/// Marker for endpoints whose 200/204 body carries no usable payload
/// (logout, `GET /api/user/me`, deletes).
public struct EmptyResponse: Codable {
    public init() {}
    public init(from decoder: Decoder) throws {}
    public func encode(to encoder: Encoder) throws {}
}

private struct AnyEncodable: Encodable {
    let base: any Encodable
    init(_ base: any Encodable) { self.base = base }
    func encode(to encoder: Encoder) throws { try base.encode(to: encoder) }
}
