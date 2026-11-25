import SwiftUI
import CommonplaceKit

/// Recent notes list with keyword search + pile/idea filters
/// (mirrors RecentList + Filter AND semantics).
struct NotesView: View {
    @EnvironmentObject var state: AppState
    @State private var notes: [Note] = []
    @State private var page = 1
    @State private var search = ""
    @State private var pileFilter = ""
    @State private var ideaFilter = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section("Search & filters") {
                    TextField("Search", text: $search)
                        .onSubmit { applySearch() }
                    TextField("Pile ids (comma-separated)", text: $pileFilter)
                    TextField("Idea ids (comma-separated)", text: $ideaFilter)
                    HStack {
                        Button("Apply") { applySearch() }
                        Button("Clear") {
                            search = ""; pileFilter = ""; ideaFilter = ""
                            page = 1; loadRecent()
                        }
                    }
                }
                if let error { Text(error).foregroundStyle(.red) }
                ForEach(notes, id: \.stableId) { n in
                    NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                        NoteRow(note: n)
                    }
                }
                Button("Load more") { loadRecent(page: page + 1) }
            }
            .navigationTitle("Notes")
            .task { loadRecent() }
        }
    }

    private func loadRecent(page wanted: Int = 1) {
        Task {
            do {
                let rows = try await state.client.recentNotes(page: wanted)
                await MainActor.run {
                    page = wanted
                    notes = wanted == 1 ? rows : notes + rows
                }
            } catch {
                await MainActor.run { self.error = "Load failed — retry." }
            }
        }
    }

    private func applySearch() {
        Task {
            do {
                let piles = pileFilter.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                let ideas = ideaFilter.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                let rows: [Note]
                if !piles.isEmpty || !ideas.isEmpty {
                    rows = try await state.client.filterNotes(piles: piles, ideas: ideas)
                } else if !search.isEmpty {
                    rows = try await state.client.findNotes(searchString: search)
                } else {
                    rows = try await state.client.recentNotes(page: 1)
                }
                await MainActor.run { notes = rows }
            } catch {
                await MainActor.run { self.error = "Search failed — retry." }
            }
        }
    }
}

/// One-line note row (mirrors the Slim list variant).
struct NoteRow: View {
    let note: Note

    var body: some View {
        VStack(alignment: .leading) {
            Text(note.title ?? "(untitled)").lineLimit(1)
            if let text = note.text, !text.isEmpty {
                Text(text).lineLimit(1).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

private extension Note {
    /// Stable across renders (no fresh UUID per evaluation).
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
