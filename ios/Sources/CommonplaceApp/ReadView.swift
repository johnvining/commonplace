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
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var work: Work?
    @State private var nick: String?
    @State private var loaded = false

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(work?.name ?? title)
                        .font(DS.serif(20, weight: .semibold)).italic().foregroundStyle(DS.ink)
                    HStack(spacing: 6) {
                        if let authors = work?.authors, !authors.isEmpty {
                            Text(authors.compactMap(\.name).joined(separator: ", "))
                        }
                        if let year = work?.year { Text(String(year)) }
                        if let url = work?.url, !url.isEmpty { Text(url) }
                    }
                    .font(DS.ui(12)).foregroundStyle(DS.muted)
                    if let nick { CopyNickButton(nick: nick) }
                    Text("\(notes.count) notes").font(DS.ui(11)).foregroundStyle(DS.muted)
                    HStack(spacing: 6) {
                        PhotosPicker(selection: $photoItems, matching: .images) {
                            DSButtonLabel(title: "Add photo notes")
                        }
                        .buttonStyle(.plain)
                        .onChange(of: photoItems) { uploadPhotoNotes() }
                        Spacer()
                    }
                }
            }
            .listRowSeparator(.hidden)
            if !loaded {
                LoadingBlock()
            } else if notes.isEmpty && error == nil {
                Text("No notes yet.").font(DS.ui(13)).italic().foregroundStyle(DS.muted)
            }
            ForEach(notes, id: \.stableId) { n in
                NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteFlowRow(note: n) }
            }
            if notes.count >= 500 { DSButton(title: "Load more") { loadMore() } }
        }
        .listStyle(.plain)
        .navigationTitle("Read")
        .refreshable { load() }
        .task { load() }
    }

    private func load() {
        Task {
            do {
            async let w = state.client.work(id: workId)
            async let rows = state.client.workNotes(id: workId, skip: 0, limit: 500)
            let (loadedWork, loadedNotes) = try await (w, rows)
            work = loadedWork
            nick = await state.nick(type: "work", id: workId)
            notes = Array(loadedNotes.reversed())
            loaded = true
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

    private func uploadPhotoNotes() {
        guard !photoItems.isEmpty else { return }
        let items = photoItems
        photoItems = []
        Task {
            do {
                for item in items {
                    if let data = try await item.loadTransferable(type: Data.self), !data.isEmpty {
                        let created = try await state.client.createNote(work: workId)
                        if let id = created._id {
                            try await state.client.uploadNoteImage(noteId: id, data: data)
                        }
                    }
                }
                load()
            } catch { self.error = "Photo notes failed: \(describe(error))" }
        }
    }
}

private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
