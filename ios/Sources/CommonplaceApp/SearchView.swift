import SwiftUI
import CommonplaceKit

/// Unified search (mirrors the overlay SearchBar → /find/:search):
/// keyword search across notes/works/authors/ideas/piles plus direct
/// nick resolution (`[nwipa]nnnnnn`).
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
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Search or paste a nick", text: $query)
                        .onChange(of: query) { _ in scheduleRun() }
                        .onSubmit { run() }
                }
                if let error { Text(error).foregroundStyle(.red) }
                if let info = nickInfo {
                    Text(info).font(.caption).foregroundStyle(.secondary)
                }
                ForEach(nickNote, id: \.stableId) { n in
                    NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                        NoteRow(note: n)
                    }
                }
                if let pid = nickPileId {
                    NavigationLink { PileDetailView(pileId: pid) } label: {
                        Text("Open pile").font(.headline)
                    }
                }
                if let wid = nickWorkId {
                    NavigationLink { WorkDetailView(workId: wid) } label: { Text("Open work").font(.headline) }
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
            }
            .navigationTitle("Search")
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

    private func run() {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        Task {
            if isNick(q) {
                if let found = try? await state.client.nickLookup(q) {
                    // Route note and pile nicks to their views; other
                    // entity types show as info until they get views.
                    if found.note != nil {
                        let rows = (try? await state.client.noteByNick(q)) ?? []
                        await MainActor.run {
                            nickNote = rows; nickPileId = nil; nickInfo = nil; items = []
                        }
                        return
                    }
                    if let pid = found.pile {
                        await MainActor.run {
                            nickNote = []; nickPileId = pid; nickInfo = nil; items = []
                        }
                        return
                    }
                    await MainActor.run {
                        nickNote = []; nickPileId = nil; items = []
                        nickWorkId = found.work; nickIdeaId = found.idea; nickAuthorId = found.auth
                        nickInfo = (found.work == nil && found.idea == nil && found.auth == nil)
                            ? "Nick not found." : nil
                    }
                    return
                }
            }
            do {
                let rows = try await state.client.unifiedSearch(query: q)
                await MainActor.run { items = rows; nickNote = []; nickPileId = nil; nickInfo = nil }
            } catch {
                await MainActor.run { self.error = "Search failed — retry." }
            }
        }
    }

    @ViewBuilder
    private func searchRow(_ item: UnifiedSearchItem) -> some View {
        let label = VStack(alignment: .leading) {
            Text(item.displayName).lineLimit(1)
            Text(item.type ?? "").font(.caption).foregroundStyle(.secondary)
        }
        if let id = item.itemId {
            switch item.type {
            case "note":
                NavigationLink { NoteDetailView(noteId: id) } label: { label }
            case "work":
                NavigationLink { WorkDetailView(workId: id) } label: { label }
            case "pile":
                NavigationLink { PileDetailView(pileId: id) } label: { label }
            case "idea":
                NavigationLink { IdeaDetailView(ideaId: id) } label: { label }
            case "auth", "author":
                NavigationLink { AuthorDetailView(authorId: id) } label: { label }
            default:
                label
            }
        } else {
            label
        }
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
