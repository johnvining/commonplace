import SwiftUI
import CommonplaceKit
import PhotosUI
#if os(iOS)
import UIKit
#endif

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
    @State private var authorOptions: [PickOption] = []
    @State private var pileOptions: [PickOption] = []
    @State private var ideaOptions: [PickOption] = []
    @State private var linked: [Note] = []
    @State private var linkNick = ""
    @State private var imageDatas: [Data] = []
    @State private var photoItem: PhotosPickerItem?
    @State private var ocrResult: String?
    @State private var suggestedTitle: String?
    @State private var suggestedIdeas: [String] = []
    @State private var error: String?
    @State private var confirming = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
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
                Section("Authors") {
                    PillEditor(
                        placeholder: "Add an author…", tint: DS.accentSoft, selected: $authorOptions,
                        load: { q in ((try? await state.client.autocompleteAuthors(q)) ?? []).compactMap { a in a._id.map { PickOption(id: $0, name: a.name ?? "") } } },
                        onAdd: { opt in authorOptions.append(opt); saveAuthors() },
                        onRemove: { opt in authorOptions.removeAll { $0.id == opt.id }; saveAuthors() },
                        onCreateNew: { name in createAuthorNamed(name) }
                    )
                }
                Section("Work") {
                    if let w = note.work {
                        Text(w.name ?? w.id).font(DS.ui(14))
                    } else {
                        Text("No work linked").font(DS.ui(12)).foregroundStyle(DS.muted)
                    }
                    TypeaheadField(
                        placeholder: "Link a work…",
                        load: { q in ((try? await state.client.autocompleteWorks(q)) ?? []).compactMap { w in w._id.map { PickOption(id: $0, name: w.name ?? "") } } },
                        onPick: { opt in Task { _ = try? await state.client.addWorkToNote(noteId: noteId, workId: opt.id); reloadNote() } },
                        onCreate: { name in Task { _ = try? await state.client.createWorkForNote(noteId: noteId, name: name); reloadNote() } }
                    )
                }
                Section("Piles") {
                    PillEditor(
                        placeholder: "Add a pile…", tint: DS.pileSoft, selected: $pileOptions,
                        load: { q in ((try? await state.client.autocompletePiles(q)) ?? []).compactMap { p in p._id.map { PickOption(id: $0, name: p.name ?? "") } } },
                        onAdd: { opt in pileOptions.append(opt); Task { _ = try? await state.client.addPileToNote(noteId: noteId, pileId: opt.id); reloadNote() } },
                        onRemove: { opt in pileOptions.removeAll { $0.id == opt.id }; Task { _ = try? await state.client.removePileFromNote(noteId: noteId, pileId: opt.id); reloadNote() } },
                        onCreateNew: { name in Task { _ = try? await state.client.createPileForNote(noteId: noteId, name: name); reloadNote() } }
                    )
                }
                Section("Ideas") {
                    PillEditor(
                        placeholder: "Add an idea…", tint: DS.accentSoft, selected: $ideaOptions,
                        load: { q in ((try? await state.client.autocompleteIdeas(q)) ?? []).compactMap { i in i._id.map { PickOption(id: $0, name: i.name ?? "") } } },
                        onAdd: { opt in ideaOptions.append(opt); Task { _ = try? await state.client.addIdeaToNote(noteId: noteId, ideaId: opt.id); reloadNote() } },
                        onRemove: { opt in ideaOptions.removeAll { $0.id == opt.id }; Task { _ = try? await state.client.removeIdeaFromNote(noteId: noteId, ideaId: opt.id); reloadNote() } },
                        onCreateNew: { name in Task { _ = try? await state.client.createIdeaForNote(noteId: noteId, name: name); reloadNote() } }
                    )
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
                Section("Images") {
                    #if os(iOS)
                    ScrollView(.horizontal) {
                        HStack {
                            ForEach(Array(imageDatas.enumerated()), id: \.offset) { idx, data in
                                if let ui = UIImage(data: data) {
                                    VStack {
                                        Image(uiImage: ui).resizable().scaledToFill()
                                            .frame(width: 90, height: 90).clipped()
                                            .clipShape(RoundedRectangle(cornerRadius: 6))
                                        Button("Delete") { deleteImage(idx) }.font(DS.ui(11))
                                    }
                                }
                            }
                        }
                    }
                    #else
                    Text("\(imageDatas.count) image(s)").font(DS.ui(12)).foregroundStyle(DS.muted)
                    #endif
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Text("Add photo")
                    }
                    .onChange(of: photoItem) { uploadPhoto() }
                    HStack {
                        Button("Run OCR") { runOCR() }
                        Button("Suggest title") { suggestTitle() }
                        Button("Suggest ideas") { suggestIdeas() }
                    }
                    if let t = suggestedTitle {
                        Button("Use title: \(t)") {
                            title = t
                            if !editing { editing = true }
                        }
                    }
                    ForEach(suggestedIdeas, id: \.self) { idea in
                        Button("Add idea: \(idea)") { addSuggestedIdea(idea) }
                    }
                    if let ocr = ocrResult {
                        Text(ocr).font(DS.serif(13))
                        Button("Append OCR to text") {
                            text = (text.isEmpty ? ocr : text + "\n\n" + ocr)
                            if !editing { editing = true }
                        }
                    }
                }
                Section("Linked notes") {
                    ForEach(linked, id: \.stableId) { n in
                        HStack {
                            NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                                NoteRow(note: n)
                            }
                            Button("Unlink") { unlink(n) }
                        }
                    }
                    HStack {
                        TextField("Link by nick (e.g. n123456)", text: $linkNick)
                        Button("Link") { linkByNick() }.disabled(linkNick.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            } else if loaded {
                Text("Note not found — it may have been deleted.")
                    .foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .listStyle(.plain)
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
                await MainActor.run { note = rows.first; loaded = true; syncOptions(from: rows.first) }
                Task { _ = try? await state.client.recordNoteOpened(id: noteId) }
                if let links = try? await state.client.linkedNotes(noteId: noteId) {
                    await MainActor.run { linked = links }
                }
                loadImages()
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

    private func loadImages() {
        Task {
            guard let count = note?.images?.count, count > 0 else { return }
            var datas: [Data] = []
            for i in 1...count {
                if let d = try? await state.client.noteImageData(noteId: noteId, index: i) {
                    datas.append(d)
                }
            }
            await MainActor.run { imageDatas = datas }
        }
    }

    private func uploadPhoto() {
        guard let item = photoItem else { return }
        Task {
            if let data = try? await item.loadTransferable(type: Data.self), !data.isEmpty {
                try? await state.client.uploadNoteImage(noteId: noteId, data: data)
                reloadNote()
                // refresh image list after the note reloads
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { loadImages() }
            }
            await MainActor.run { photoItem = nil }
        }
    }

    private func deleteImage(_ idx: Int) {
        guard let filename = note?.images?[idx] else { return }
        Task {
            try? await state.client.deleteNoteImage(noteId: noteId, filename: filename)
            reloadNote()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { loadImages() }
        }
    }

    private func runOCR() {
        Task {
            if let result = try? await state.client.ocrText(noteId: noteId) {
                await MainActor.run { ocrResult = result.isEmpty ? "(no text found)" : result }
            } else {
                await MainActor.run { self.error = "OCR failed — retry." }
            }
        }
    }

    private func suggestTitle() {
        Task {
            if let s = try? await state.client.suggestTitle(noteId: noteId) {
                await MainActor.run { suggestedTitle = s.suggested_title }
            }
        }
    }

    private func suggestIdeas() {
        Task {
            if let s = try? await state.client.suggestIdeas(noteId: noteId) {
                await MainActor.run { suggestedIdeas = s.suggested_ideas ?? [] }
            }
        }
    }

    private func addSuggestedIdea(_ name: String) {
        Task {
            _ = try? await state.client.createIdeaForNote(noteId: noteId, name: name)
            reloadNote()
        }
    }

    private func reloadLinked() {
        Task {
            if let links = try? await state.client.linkedNotes(noteId: noteId) {
                await MainActor.run { linked = links }
            }
        }
    }

    private func linkByNick() {
        let nick = linkNick.trimmingCharacters(in: .whitespaces)
        guard !nick.isEmpty else { return }
        Task {
            do {
                let own = try await state.client.nickFor(type: "note", id: noteId)
                guard let ownKey = own.key, !ownKey.isEmpty else {
                    await MainActor.run { self.error = "Could not resolve this note's nick." }
                    return
                }
                _ = try await state.client.linkNotes(leftNick: ownKey, rightNick: nick)
                await MainActor.run { linkNick = "" }
                reloadLinked()
            } catch {
                await MainActor.run { self.error = "Link failed — check the nick." }
            }
        }
    }

    private func unlink(_ n: Note) {
        guard let other = n._id else { return }
        Task {
            try? await state.client.unlinkNotes(a: noteId, b: other)
            reloadLinked()
        }
    }

    private func reloadNote() {
        Task {
            if let rows = try? await state.client.note(id: noteId) {
                await MainActor.run { note = rows.first; syncOptions(from: rows.first) }
            }
        }
    }

    private func syncOptions(from n: Note?) {
        guard let n else { return }
        authorOptions = (n.authors ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
        pileOptions = (n.piles ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
        ideaOptions = (n.ideas ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
    }

    private func saveAuthors() {
        let ids = authorOptions.map(\.id)
        Task {
            do {
                let updated = try await state.client.updateNote(id: noteId, NoteUpdate(authors: ids))
                await MainActor.run { note = updated; syncOptions(from: updated) }
            } catch {
                await MainActor.run { self.error = "Author save failed — retry." }
            }
        }
    }

    private func createAuthorNamed(_ name: String) {
        Task {
            if let a = try? await state.client.createAuthor(name: name), let id = a._id {
                await MainActor.run { authorOptions.append(PickOption(id: id, name: a.name ?? name)) }
                saveAuthors()
            }
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

private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
