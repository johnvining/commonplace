import SwiftUI
import CommonplaceKit

/// Unified search (mirrors the overlay SearchBar → /find/:search):
/// keyword search across notes/works/authors/ideas/piles plus direct
/// nick resolution (`[nwipa]nnnnnn`) and typed modifiers
/// (`auth:`/`find:`/`idea:`/`list:`/`note:`/`pile:`/`work:`/`read:`).
struct SearchView: View {
    @EnvironmentObject var state: AppState
    @State private var query = ""
    @State private var items: [UnifiedSearchItem] = []
    @State private var nickNote: [Note] = []
    @State private var nickPileId: String?
    @State private var nickWorkId: String?
    @State private var nickIdeaId: String?
    @State private var nickAuthorId: String?
    @State private var nickInfo: String?
    @State private var error: String?
    @State private var searching = false
    @State private var hasSearched = false
    @State private var newNoteId: String?
    @State private var showingNewNote = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Search or paste a nick", text: $query)
                        .onChange(of: query) { scheduleRun() }
                        .onSubmit { run() }
                    Text("Prefixes: auth: find: idea: list: note: pile: work: read:")
                        .font(DS.ui(11)).foregroundStyle(DS.muted)
                    Button("Create note from search") { createNoteFromSearch() }
                        .font(DS.ui(12))
                }
                if searching { LoadStateView(state: .loading) }
                if let error { Text(error).foregroundStyle(.red) }
                if let info = nickInfo {
                    Text(info).font(.caption).foregroundStyle(.secondary)
                }
                if hasSearched && !searching && items.isEmpty && nickNote.isEmpty && nickPileId == nil && nickWorkId == nil && nickIdeaId == nil && nickAuthorId == nil && nickInfo == nil {
                    Text("No results.").font(DS.ui(13)).foregroundStyle(DS.muted)
                }
                ForEach(nickNote, id: \.stableId) { n in
                    NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                        NoteRow(note: n)
                    }
                }
                if let pid = nickPileId {
                    NavigationLink { PileDetailView(pileId: pid) } label: { Text("Open pile").font(.headline) }
                }
                if let wid = nickWorkId {
                    NavigationLink { WorkDetailView(workId: wid) } label: { Text("Open work").font(.headline) }
                    NavigationLink { ReadView(workId: wid, title: "Read") } label: { Text("Read work").font(DS.ui(13)) }
                }
                if let iid = nickIdeaId {
                    NavigationLink { IdeaDetailView(ideaId: iid) } label: { Text("Open idea").font(.headline) }
                }
                if let aid = nickAuthorId {
                    NavigationLink { AuthorDetailView(authorId: aid) } label: { Text("Open author").font(.headline) }
                }
                ForEach(items, id: \.stableId) { item in
                    searchRow(item)
                }
                if items.count >= 20 {
                    Button("Load more results") { run(loadMore: true) }.font(DS.ui(13))
                }
            }
            .navigationTitle("Search")
            .navigationDestination(isPresented: $showingNewNote) {
                NoteDetailView(noteId: newNoteId ?? "", editFirst: true)
            }
        }
    }

    private func createNoteFromSearch() {
        let title = query.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                let created = try await state.client.createNote(title: title.isEmpty ? nil : title)
                guard let id = created._id else { self.error = "Create returned no id."; return }
                newNoteId = id; showingNewNote = true
            } catch { self.error = "Create note failed: \(describe(error))" }
        }
    }

    private func scheduleRun() {
        searchTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            await MainActor.run { run() }
        }
    }

    /// Split a leading `auth:`/`note:`/… modifier off the query.
    private func parseModifier(_ q: String) -> (type: String?, term: String) {
        let known = ["auth", "find", "idea", "list", "note", "pile", "work", "read"]
        for k in known where q.lowercased().hasPrefix("\(k):") {
            return (k, String(q.dropFirst(k.count + 1)).trimmingCharacters(in: .whitespaces))
        }
        return (nil, q)
    }

    private func run(loadMore: Bool = false) {
        let raw = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return }
        let (modifier, term) = parseModifier(raw)
        searching = true; hasSearched = true
        Task {
            defer { Task { @MainActor in searching = false } }
            if !loadMore, isNick(term) {
                do {
                    if let found = try await state.client.nickLookup(term) {
                        await MainActor.run { applyNick(found) }
                        if nickNote.isEmpty && nickPileId == nil && nickWorkId == nil && nickIdeaId == nil && nickAuthorId == nil {
                            Task { await self.loadNickNotes(term) }
                        }
                        return
                    } else {
                        await MainActor.run { nickInfo = "Nick not found."; items = [] }
                        return
                    }
                } catch {
                    await MainActor.run { self.error = "Nick lookup failed: \(describe(error))" }
                    return
                }
            }
            do {
                let limit = loadMore ? items.count + 20 : 20
                var rows = try await state.client.unifiedSearch(query: term, limit: limit)
                if let modifier, modifier != "find" {
                    let wanted = modifier == "auth" ? ["auth", "author"] : [modifier]
                    rows = rows.filter { wanted.contains($0.type ?? "") }
                    // Exact-name open: jump straight to the entity when a
                    // row's name matches the term exactly.
                    if let exact = rows.first(where: { $0.displayName.lowercased() == term.lowercased() }) {
                        rows = [exact]
                    }
                }
                await MainActor.run { items = rows; nickNote = []; nickPileId = nil; nickInfo = nil; error = nil }
            } catch {
                await MainActor.run { self.error = "Search failed: \(describe(error))" }
            }
        }
    }

    private func loadNickNotes(_ nick: String) async {
        do {
            let rows = try await state.client.noteByNick(nick)
            await MainActor.run { nickNote = rows }
        } catch { await MainActor.run { self.error = "Nick notes failed: \(describe(error))" } }
    }

    private func applyNick(_ found: NickLookup) {
        nickNote = []; nickPileId = nil; nickWorkId = nil; nickIdeaId = nil; nickAuthorId = nil; items = []
        if found.retired == true || found.state == "retired" {
            nickInfo = found.name.map { "This nick was retired — “\($0)” was deleted." } ?? "This nick was retired."
            return
        }
        if found.state == "alias", let from = found.mergedFrom {
            nickInfo = "Merged — forwarded from \(from)."
        } else { nickInfo = nil }
        nickPileId = found.pile; nickWorkId = found.work; nickIdeaId = found.idea; nickAuthorId = found.auth
        if found.note != nil {
            // Note nicks resolve through noteByNick in loadNickNotes.
            nickInfo = nickInfo ?? nil
        } else if found.pile == nil && found.work == nil && found.idea == nil && found.auth == nil && found.note == nil {
            nickInfo = "Nick not found."
        }
    }

    @ViewBuilder
    private func searchRow(_ item: UnifiedSearchItem) -> some View {
        let label = VStack(alignment: .leading, spacing: 2) {
            Text(item.displayName).lineLimit(1)
            HStack(spacing: 6) {
                Text(item.type ?? "").font(.caption).foregroundStyle(.secondary)
                if item.type == "note" { Text("note").font(DS.ui(10)).foregroundStyle(DS.accent) }
            }
            if let snippet = snippet(for: item) {
                Text(snippet).font(DS.serif(12)).foregroundStyle(DS.muted).lineLimit(2)
            }
        }
        if let id = item.itemId {
            HStack {
                Group {
                    switch item.type {
                    case "note": NavigationLink { NoteDetailView(noteId: id) } label: { label }
                    case "work": NavigationLink { WorkDetailView(workId: id) } label: { label }
                    case "pile": NavigationLink { PileDetailView(pileId: id) } label: { label }
                    case "idea": NavigationLink { IdeaDetailView(ideaId: id) } label: { label }
                    case "auth", "author": NavigationLink { AuthorDetailView(authorId: id) } label: { label }
                    default: label
                    }
                }
                Spacer()
                if let type = item.type {
                    Button {
                        if state.pins.contains(where: { $0.type == type && $0.id == id }) {
                            state.queueUnpin(type: type, id: id)
                        } else {
                            state.queuePin(type: type, id: id, label: item.displayName, href: nil)
                        }
                    } label: {
                        Image(systemName: state.pins.contains(where: { $0.type == type && $0.id == id }) ? "star.fill" : "star")
                    }
                }
            }
        } else { label }
    }

    private func snippet(for item: UnifiedSearchItem) -> String? {
        let body = item.item?.text ?? item.item?.take
        guard let body, !body.isEmpty else { return item.displayName.isEmpty ? "(empty note)" : nil }
        let term = parseModifier(query.trimmingCharacters(in: .whitespacesAndNewlines)).term
        if let range = body.lowercased().range(of: term.lowercased()), !term.isEmpty {
            let start = body.index(range.lowerBound, offsetBy: -40, limitedBy: body.startIndex) ?? body.startIndex
            let end = body.index(range.upperBound, offsetBy: 60, limitedBy: body.endIndex) ?? body.endIndex
            return "…\(body[start..<end])…"
        }
        return String(body.prefix(120))
    }

    private func isNick(_ s: String) -> Bool {
        s.range(of: "^[nwipa][0-9]{6}$", options: .regularExpression) != nil
    }
}

private extension UnifiedSearchItem {
    var stableId: String { "\((type ?? "?")):\(itemId ?? displayName)" }
}

private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
