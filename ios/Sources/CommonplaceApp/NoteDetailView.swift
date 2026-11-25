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
    @State private var pileQuery = ""
    @State private var pileSuggestions: [Pile] = []
    @State private var ideaQuery = ""
    @State private var ideaSuggestions: [Idea] = []
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
                }
                Section("Piles") {
                    ForEach(note.piles ?? [], id: \.id) { p in
                        HStack {
                            Text(p.name ?? p.id)
                            Spacer()
                            Button("Remove") { removePile(p) }
                        }
                    }
                    TextField("Add pile…", text: $pileQuery)
                        .onSubmit { searchPiles() }
                    ForEach(pileSuggestions, id: \.stableId) { p in
                        Button(p.name ?? "") { addPile(p) }
                    }
                    if !pileQuery.trimmingCharacters(in: .whitespaces).isEmpty {
                        Button("Create pile “\(pileQuery)”") { createPile() }
                    }
                }
                Section("Ideas") {
                    ForEach(note.ideas ?? [], id: \.id) { i in
                        HStack {
                            Text(i.name ?? i.id)
                            Spacer()
                            Button("Remove") { removeIdea(i) }
                        }
                    }
                    TextField("Add idea…", text: $ideaQuery)
                        .onSubmit { searchIdeas() }
                    ForEach(ideaSuggestions, id: \.stableId) { i in
                        Button(i.name ?? "") { addIdea(i) }
                    }
                    if !ideaQuery.trimmingCharacters(in: .whitespaces).isEmpty {
                        Button("Create idea “\(ideaQuery)”") { createIdea() }
                    }
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
                await MainActor.run { self.error = "Load failed — retry."; loaded = true }
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
                await MainActor.run { self.error = "Save failed — still editing." }
            }
        }
    }

    private func remove() {
        Task {
            try? await state.client.deleteNote(id: noteId)
            await MainActor.run { dismiss() }
        }
    }

    private func reloadNote() {
        Task {
            if let rows = try? await state.client.note(id: noteId) {
                await MainActor.run { note = rows.first }
            }
        }
    }

    private func searchPiles() {
        let q = pileQuery.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { return }
        Task { pileSuggestions = (try? await state.client.autocompletePiles(q)) ?? [] }
    }

    private func addPile(_ p: Pile) {
        guard let pid = p._id else { return }
        Task {
            _ = try? await state.client.addPileToNote(noteId: noteId, pileId: pid)
            await MainActor.run { pileQuery = ""; pileSuggestions = [] }
            reloadNote()
        }
    }

    private func createPile() {
        let name = pileQuery.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            _ = try? await state.client.createPileForNote(noteId: noteId, name: name)
            await MainActor.run { pileQuery = ""; pileSuggestions = [] }
            reloadNote()
        }
    }

    private func removePile(_ p: PopulatedRef) {
        Task {
            _ = try? await state.client.removePileFromNote(noteId: noteId, pileId: p.id)
            reloadNote()
        }
    }

    private func searchIdeas() {
        let q = ideaQuery.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { return }
        Task { ideaSuggestions = (try? await state.client.autocompleteIdeas(q)) ?? [] }
    }

    private func addIdea(_ i: Idea) {
        guard let iid = i._id else { return }
        Task {
            _ = try? await state.client.addIdeaToNote(noteId: noteId, ideaId: iid)
            await MainActor.run { ideaQuery = ""; ideaSuggestions = [] }
            reloadNote()
        }
    }

    private func createIdea() {
        let name = ideaQuery.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            _ = try? await state.client.createIdeaForNote(noteId: noteId, name: name)
            await MainActor.run { ideaQuery = ""; ideaSuggestions = [] }
            reloadNote()
        }
    }

    private func removeIdea(_ i: PopulatedRef) {
        Task {
            _ = try? await state.client.removeIdeaFromNote(noteId: noteId, ideaId: i.id)
            reloadNote()
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

private extension Pile {
    var stableId: String { _id ?? ["p", name].compactMap { $0 }.joined(separator: "|") }
}
private extension Idea {
    var stableId: String { _id ?? ["i", name].compactMap { $0 }.joined(separator: "|") }
}
