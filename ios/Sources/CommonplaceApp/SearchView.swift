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
    @State private var nickInfo: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Search or paste a nick", text: $query)
                        .onSubmit { run() }
                    Button("Search") { run() }
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
                ForEach(items, id: \.stableId) { item in
                    VStack(alignment: .leading) {
                        Text(item.title ?? item.name ?? "(unnamed)").lineLimit(1)
                        Text(item.type ?? "").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Search")
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
                    let what: String
                    if found.work != nil { what = "work" }
                    else if found.idea != nil { what = "idea" }
                    else if found.auth != nil { what = "author" }
                    else { what = "record" }
                    await MainActor.run {
                        nickNote = []; nickPileId = nil; items = []
                        nickInfo = "Nick resolves to a \(what) — no viewer yet."
                    }
                    return
                }
            }
            do {
                let rows = try await state.client.unifiedSearch(query: q)
                await MainActor.run { items = rows; nickNote = []; nickPileId = nil; nickInfo = nil }
            } catch {
                await MainActor.run { error = "Search failed — retry." }
            }
        }
    }

    private func isNick(_ s: String) -> Bool {
        s.range(of: "^[nwipa][0-9]{6}$", options: .regularExpression) != nil
    }
}

private extension UnifiedSearchItem {
    var stableId: String { "\((type ?? "?")):\((_id ?? title ?? name ?? ""))" }
}

private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
