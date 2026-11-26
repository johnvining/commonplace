import SwiftUI
import CommonplaceKit
import PhotosUI

/// Read page (web /read/:id): a work's notes in reverse order, paged,
/// with a Quick Photo Note per image.
struct ReadView: View {
    @EnvironmentObject var state: AppState
    let workId: String
    let title: String
    @State private var notes: [Note] = []
    @State private var error: String?
    @State private var photoItems: [String: [PhotosPickerItem]] = [:]

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            Section {
                Text(title).font(.headline)
                Text("\(notes.count) notes").font(DS.ui(11)).foregroundStyle(DS.muted)
            }
            ForEach(notes, id: \.stableId) { n in
                VStack(alignment: .leading, spacing: 4) {
                    NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteRow(note: n, full: true) }
                    if let id = n._id {
                        PhotosPicker(selection: binding(for: id), matching: .images) {
                            Text("Quick Photo Note").font(DS.ui(12))
                        }
                        .onChange(of: photoItems[id] ?? []) { uploadQuickPhoto(noteId: id) }
                    }
                }
            }
            if notes.count >= 500 { Button("Load more") { loadMore() } }
        }
        .listStyle(.plain)
        .navigationTitle("Read")
        .refreshable { load() }
        .task { load() }
    }

    private func binding(for id: String) -> Binding<[PhotosPickerItem]> {
        Binding(get: { photoItems[id] ?? [] }, set: { photoItems[id] = $0 })
    }

    private func load() {
        Task {
            do { notes = Array(try await state.client.workNotes(id: workId, skip: 0, limit: 500).reversed()) }
            catch { self.error = "Load failed: \(describe(error))" }
        }
    }

    private func loadMore() {
        Task {
            do {
                let more = try await state.client.workNotes(id: workId, skip: notes.count, limit: 500)
                notes += Array(more.reversed())
            } catch { self.error = "Load more failed: \(describe(error))" }
        }
    }

    private func uploadQuickPhoto(noteId: String) {
        guard let items = photoItems[noteId], !items.isEmpty else { return }
        Task {
            do {
                for item in items {
                    if let data = try await item.loadTransferable(type: Data.self), !data.isEmpty {
                        try await state.client.uploadNoteImage(noteId: noteId, data: data)
                    }
                }
                load()
            } catch { self.error = "Photo note failed: \(describe(error))" }
            photoItems[noteId] = []
        }
    }
}

private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
