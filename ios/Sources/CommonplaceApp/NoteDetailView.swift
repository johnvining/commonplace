import SwiftUI
import CommonplaceKit

/// Single note: full card, star, edit, delete (mirrors NoteView).
struct NoteDetailView: View {
    @EnvironmentObject var state: AppState
    let noteId: String
    @State private var note: Note?
    @State private var loaded = false
    @State private var editing = false
    @State private var title = ""
    @State private var text = ""
    @State private var take = ""
    @State private var error: String?
    @State private var confirming = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            if let error { Text(error).foregroundStyle(.red) }
            if let note {
                Section {
                    if editing {
                        TextField("Title", text: $title)
                        TextField("Text", text: $text, axis: .vertical)
                        TextField("Take", text: $take, axis: .vertical)
                        Button("Save") { save() }
                    } else {
                        Text(note.title ?? "(untitled)").font(.headline)
                        if let t = note.text, !t.isEmpty { Text(t) }
                        if let k = note.take, !k.isEmpty { Text(k).italic() }
                        if let nick = note.nick { Text("nick: \(nick)").font(.caption) }
                    }
                }
                Section("Tags") {
                    Text("Authors: \(note.authors?.compactMap(\.name).joined(separator: ", ") ?? "")")
                    Text("Ideas: \(note.ideas?.compactMap(\.name).joined(separator: ", ") ?? "")")
                    Text("Piles: \(note.piles?.compactMap(\.name).joined(separator: ", ") ?? "")")
                }
                Section {
                    HStack {
                        Button(starred ? "★ Starred" : "☆ Star") { toggleStar() }
                        Button(editing ? "Cancel" : "Edit") {
                            title = note.title ?? ""; text = note.text ?? ""; take = note.take ?? ""
                            editing.toggle()
                        }
                        Button("Delete") { confirming = true }
                            .confirmationDialog("Delete note?", isPresented: $confirming) {
                                Button("Delete", role: .destructive) { remove() }
                            }
                    }
                }
            } else if loaded {
                Text("Note not found — it may have been deleted.")
                    .foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .navigationTitle("Note")
        .task { load() }
    }

    private var starred: Bool {
        state.pins.contains { $0.type == "note" && $0.id == noteId }
    }

    private func load() {
        Task {
            do {
                let rows = try await state.client.note(id: noteId)
                await MainActor.run { note = rows.first; loaded = true }
                Task { _ = try? await state.client.recordNoteOpened(id: noteId) }
            } catch {
                await MainActor.run { error = "Load failed — retry."; loaded = true }
            }
        }
    }

    private func save() {
        Task {
            do {
                let updated = try await state.client.updateNote(
                    id: noteId, NoteUpdate(title: title, text: text, take: take))
                await MainActor.run { note = updated; editing = false }
            } catch {
                await MainActor.run { error = "Save failed — still editing." }
            }
        }
    }

    private func remove() {
        Task {
            try? await state.client.deleteNote(id: noteId)
            await MainActor.run { dismiss() }
        }
    }

    private func toggleStar() {
        if starred {
            state.queueUnpin(type: "note", id: noteId)
        } else {
            state.queuePin(type: "note", id: noteId,
                           label: note?.title, href: "/note/\(noteId)")
        }
    }
}
