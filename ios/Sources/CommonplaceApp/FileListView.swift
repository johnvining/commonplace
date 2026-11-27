import SwiftUI
import CommonplaceKit

/// Notes to file (web /file): unfiled notes, earliest first.
struct FileListView: View {
    @EnvironmentObject var state: AppState
    @State private var notes: [Note] = []
    @State private var page = 1
    @State private var error: String?
    @State private var loaded = false

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            if !loaded {
                LoadingBlock()
            } else if notes.isEmpty && error == nil {
                Text("Nothing to file.").font(DS.ui(13)).italic().foregroundStyle(DS.muted)
            }
            ForEach(notes, id: \.stableId) { n in
                NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteRow(note: n) }
            }
            if notes.count >= 500 { DSButton(title: "Load more") { load(page: page + 1) } }
        }
        .listStyle(.plain)
        .navigationTitle("Notes to file")
        .refreshable { load(page: 1) }
        .task { load(page: 1) }
    }

    private func load(page wanted: Int) {
        Task {
            do {
                let rows = try await state.client.unfiledNotes(page: wanted)
                await MainActor.run { page = wanted; notes = wanted == 1 ? rows : notes + rows; loaded = true }
            } catch { await MainActor.run { self.error = "Load failed: \(describe(error))" } }
        }
    }
}

private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
