import SwiftUI
import CommonplaceKit
import PhotosUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Single note: full card, star, edit, delete (mirrors NoteView).
struct NoteDetailView: View {
    @EnvironmentObject var state: AppState
    let noteId: String
    var editFirst: Bool = false
    @State private var note: Note?
    @State private var loaded = false
    @State private var editing = false
    @State private var title = ""
    @State private var text = ""
    @State private var take = ""
    @State private var urlField = ""
    @State private var yearField = ""
    @State private var pageField = ""
    @State private var authorOptions: [PickOption] = []
    @State private var peopleOptions: [PickOption] = []
    @State private var pileOptions: [PickOption] = []
    @State private var ideaOptions: [PickOption] = []
    @State private var linked: [Note] = []
    @State private var linkNick = ""
    @State private var imageDatas: [Data] = []
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var uploading = false
    @State private var lightboxIndex: Int?
    @State private var ocrResult: String?
    @State private var suggestedTitle: String?
    @State private var fewerFields = false
    @State private var suggestedIdeas: [String] = []
    @State private var suggestBusy = false
    @State private var error: String?
    @State private var toast: String?
    @State private var confirming = false
    @State private var confirmingDismiss = false
    private enum EditField: Hashable { case title }
    @FocusState private var focusedField: EditField?
    @Environment(\.dismiss) private var dismiss
    #if os(macOS)
    @Environment(\.openWindow) private var openWindow
    #endif

    private var dirty: Bool {
        guard let n = note else { return false }
        return editing && (title != (n.title ?? "") || text != (n.text ?? "") || take != (n.take ?? "")
            || urlField != (n.url ?? "") || yearField != (n.year.map(String.init) ?? "") || pageField != (n.page ?? ""))
    }

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger).listRowSeparator(.hidden) }
            if let note {
                Section {
                    if editing {
                        editField("Title") {
                            TextField("Title", text: $title)
                                .dsInput()
                                .font(DS.noteTitle())
                                .focused($focusedField, equals: .title)
                        }
                        editField("Text") {
                            TextField("Text", text: $text, axis: .vertical)
                                .dsInput()
                                .font(DS.reading(15))
                        }
                        editField("Take") {
                            TextField("Take", text: $take, axis: .vertical)
                                .dsInput()
                                .font(DS.reading(14))
                        }
                        editField("URL") {
                            TextField("URL", text: $urlField)
                                .dsInput()
                                .font(DS.mono(13))
                                .autocorrectionDisabled()
                        }
                        HStack(spacing: 12) {
                            editField("Year") {
                                TextField("Year", text: $yearField).dsInput().font(DS.ui(13))
                            }
                            editField("Page") {
                                TextField("Page", text: $pageField).dsInput().font(DS.ui(13))
                            }
                        }
                        HStack {
                            DSButton(title: "Save") { save() }
                                .keyboardShortcut("a", modifiers: [.control])
                            DSButton(title: "Format text") { formatText() }
                                .keyboardShortcut("f", modifiers: [.control])
                            Spacer()
                        }
                        if dirty { Text("Unsaved changes").font(DS.ui(11)).foregroundStyle(DS.danger) }
                    } else {
                        // Web action bar: icon buttons at the top-right
                        // of the reading card (labels via help).
                        HStack(spacing: 6) {
                            Spacer()
                            DSIconButton(systemImage: starred ? "star.fill" : "star", selected: starred, label: starred ? "Starred" : "Star") { toggleStar() }
                                .keyboardShortcut("s", modifiers: [.control])
                            DSIconButton(systemImage: "pencil", label: "Edit") { beginEditing() }
                                .keyboardShortcut("e", modifiers: [.control])
                            DSIconButton(systemImage: "trash", label: "Delete") { confirming = true }
                                .keyboardShortcut("#", modifiers: [.shift])
                            if let web = state.webURL(path: "note/\(noteId)") {
                                Link(destination: web) {
                                    Image(systemName: "arrow.up.forward.square")
                                        .font(DS.ui(12, weight: .medium))
                                        .frame(width: 26, height: 26)
                                }
                                .buttonStyle(.plain)
                                .foregroundStyle(DS.ink)
                                .overlay(RoundedRectangle(cornerRadius: 5).stroke(DS.hairline, lineWidth: 1))
                                .clipShape(RoundedRectangle(cornerRadius: 5))
                                .help("Open in web")
                            }
                        }
                        .confirmationDialog("Delete note?", isPresented: $confirming) {
                            Button("Delete", role: .destructive) { remove() }
                        }
                        NoteStatusLine(note: note)
                        // Reading card like the web note: image on top,
                        // serif title, take in italics. (No accent edge:
                        // on the web the blue bar means keyboard-selected,
                        // and this note is not in a selection.)
                        HStack(alignment: .top, spacing: 12) {
                            VStack(alignment: .leading, spacing: 8) {
                                if !imageDatas.isEmpty {
                                    // Web image row: every image once,
                                    // small — never a giant cropped hero.
                                    ScrollView(.horizontal, showsIndicators: false) {
                                        HStack(spacing: 6) {
                                            ForEach(Array(imageDatas.enumerated()), id: \.offset) { idx, data in
                                                NoteImageView(data: data)
                                                    .frame(width: 120, height: 80)
                                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                                                    .onTapGesture { lightboxIndex = idx }
                                            }
                                        }
                                    }
                                }
                                // The note page shows the real title
                                // only — the title→text→take→URL cascade
                                // is for list rows, which need something
                                // to show. No fake titles here.
                                Text(note.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                                     ? note.title! : "(untitled)")
                                    .font(DS.noteTitle())
                                    .tracking(-0.075)
                                    .lineSpacing(2)
                                    .foregroundStyle(DS.ink)
                                if !note.displayAuthors.isEmpty || note.work != nil {
                                    HStack(spacing: 6) {
                                        if !note.displayAuthors.isEmpty {
                                            Text(note.displayAuthors.compactMap(\.name).joined(separator: ", "))
                                        }
                                        if let w = note.work?.name, !w.isEmpty {
                                            Text(w).italic()
                                        }
                                    }
                                    .font(DS.ui(13))
                                    .foregroundStyle(DS.muted)
                                }
                                if let ts = note.titleSource, !ts.isEmpty {
                                    Text("title source: \(ts)").font(DS.ui(11)).foregroundStyle(DS.muted)
                                }
                                if let t = note.text, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                    NoteText(text: t)
                                }
                                if let k = note.take, !k.isEmpty {
                                    HStack(alignment: .top, spacing: 0) {
                                        Rectangle().fill(DS.hairline).frame(width: 2)
                                        Text(k).font(DS.reading(14)).italic().foregroundStyle(DS.muted).lineSpacing(5).padding(.leading, 10)
                                    }
                                }
                                if let u = note.url, !u.isEmpty,
                                   u != note.text?.trimmingCharacters(in: .whitespacesAndNewlines) {
                                    Text(u).font(DS.ui(11)).foregroundStyle(DS.muted)
                                }
                                if note.year != nil || (note.page?.isEmpty == false) {
                                    Text([note.year.map(String.init), note.page].compactMap { $0 }.joined(separator: " · "))
                                        .font(DS.ui(11)).foregroundStyle(DS.muted)
                                }
                                // Piles/ideas (and people/work) tags at
                                // the top of the page, right-aligned, in
                                // the web's square kind-tag format.
                                if !(note.piles ?? []).isEmpty || !(note.ideas ?? []).isEmpty
                                    || !(note.people ?? []).isEmpty {
                                    HStack(alignment: .top, spacing: 0) {
                                        Spacer(minLength: 24)
                                        FlowLayout(spacing: 4) {
                                            ForEach(note.piles ?? [], id: \.id) { p in
                                                NavigationLink { PileDetailView(pileId: p.id) } label: {
                                                    linkTag(p.name ?? "", color: DS.pile, tint: DS.pileSoft)
                                                }.buttonStyle(.plain)
                                            }
                                            ForEach(note.ideas ?? [], id: \.id) { i in
                                                NavigationLink { IdeaDetailView(ideaId: i.id) } label: {
                                                    linkTag(i.name ?? "", color: DS.accent, tint: DS.accentSoft)
                                                }.buttonStyle(.plain)
                                            }
                                            ForEach(note.people ?? [], id: \.id) { a in
                                                NavigationLink { AuthorDetailView(authorId: a.id) } label: {
                                                    linkTag(a.name ?? "", color: DS.muted, tint: .clear)
                                                }.buttonStyle(.plain)
                                            }
                                        }
                                    }
                                }
                                if let nick = note.nick { CopyNickButton(nick: nick) }
                            }
                            .padding(.vertical, 2)
                        }
                        .listRowInsets(EdgeInsets(top: 6, leading: 6, bottom: 6, trailing: 6))
                        .listRowBackground(DS.surface)
                    }
                }
                .listRowSeparator(.hidden)
                // Labels (Authors/Work/Piles/…) belong to the edit form
                // only. Read mode shows the linked things themselves,
                // unlabeled, and tapping one opens it — never deletes.
                // Ctrl+M toggles these link sections (fewer/all fields).
                if editing && !fewerFields {
                    Section("Authors") {
                        PillEditor(
                            placeholder: "Add an author…", tint: DS.accentSoft, selected: $authorOptions,
                            load: { q in ((try? await state.client.autocompleteAuthors(q)) ?? []).compactMap { a in a._id.map { PickOption(id: $0, name: a.name ?? "") } } },
                            onAdd: { opt in authorOptions.append(opt); saveAuthors() },
                            onRemove: { opt in authorOptions.removeAll { $0.id == opt.id }; saveAuthors() },
                            onCreateNew: { name in createAuthorNamed(name) }
                        )
                    }
                    Section("About (people)") {
                        PillEditor(
                            placeholder: "Add a person this is about…", tint: DS.accentSoft, selected: $peopleOptions,
                            load: { q in ((try? await state.client.autocompleteAuthors(q)) ?? []).compactMap { a in a._id.map { PickOption(id: $0, name: a.name ?? "", subtitle: yearsLabel(a)) } } },
                            onAdd: { opt in peopleOptions.append(opt); savePeople() },
                            onRemove: { opt in peopleOptions.removeAll { $0.id == opt.id }; savePeople() },
                            onCreateNew: { name in createPersonNamed(name) }
                        )
                    }
                    Section("Work") {
                        if let w = note.work {
                            Text(w.name ?? w.id).font(DS.serif(14.5)).italic().foregroundStyle(DS.ink)
                        }
                        TypeaheadField(
                            placeholder: "Link a work…",
                            load: { q in ((try? await state.client.autocompleteWorks(q)) ?? []).compactMap { w in w._id.map { PickOption(id: $0, name: w.name ?? "") } } },
                            onPick: { opt in Task { do { _ = try await state.client.addWorkToNote(noteId: noteId, workId: opt.id); reloadNote() } catch { self.error = "Work link failed: \(describe(error))" } } },
                            onCreate: { name in Task { do { _ = try await state.client.createWorkForNote(noteId: noteId, name: name); reloadNote() } catch { self.error = "Work create failed: \(describe(error))" } } }
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
                }
                // (Read-mode tags live in the reading card now, right-
                // aligned under the text — nothing more to render here.)
                if editing {
                Section {
                    HStack(spacing: 6) {
                        DSButton(title: starred ? "Starred" : "Star", selected: starred) { toggleStar() }
                        DSButton(title: editing ? "Cancel" : "Edit") {
                            title = note.title ?? ""; text = note.text ?? ""; take = note.take ?? ""
                            urlField = note.url ?? ""; yearField = note.year.map(String.init) ?? ""; pageField = note.page ?? ""
                            editing.toggle()
                        }
                        DSButton(title: "Delete") { confirming = true }
                        OpenInWebButton(path: "note/\(noteId)")
                        Spacer()
                    }
                    .confirmationDialog("Delete note?", isPresented: $confirming) {
                        Button("Delete", role: .destructive) { remove() }
                    }
                }
                .listRowSeparator(.hidden)
                }
                // Images: read mode is just the photos (+ lightbox);
                // add/delete/OCR/suggest are Edit-mode tools. The whole
                // section disappears when there's nothing to show.
                if editing || !imageDatas.isEmpty {
                    Section("Images") {
                        if !imageDatas.isEmpty {
                            ScrollView(.horizontal) {
                                HStack {
                                    ForEach(Array(imageDatas.enumerated()), id: \.offset) { idx, data in
                                        VStack {
                                            NoteImageView(data: data)
                                                .frame(width: 90, height: 90)
                                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                                .onTapGesture { lightboxIndex = idx }
                                            if editing {
                                                DSButton(title: "Delete") { deleteImage(idx) }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if let idx = lightboxIndex, imageDatas.indices.contains(idx) {
                            VStack {
                                NoteImageView(data: imageDatas[idx], contentMode: .fit)
                                    .frame(maxHeight: 420)
                                HStack {
                                    DSButton(title: "‹ Prev") { lightboxIndex = max(0, idx - 1) }.disabled(idx == 0).opacity(idx == 0 ? 0.5 : 1)
                                    Text("\(idx + 1) / \(imageDatas.count)").font(DS.ui(11)).foregroundStyle(DS.muted)
                                    DSButton(title: "Next ›") { lightboxIndex = min(imageDatas.count - 1, idx + 1) }.disabled(idx >= imageDatas.count - 1).opacity(idx >= imageDatas.count - 1 ? 0.5 : 1)
                                    DSButton(title: "Close") { lightboxIndex = nil }
                                }
                            }
                        }
                        if editing {
                            PhotosPicker(selection: $photoItems, matching: .images) {
                                Text(uploading ? "Uploading…" : "Add photos")
                            }
                            .keyboardShortcut("u", modifiers: [.control])
                            .onChange(of: photoItems) { uploadPhotos() }
                            if uploading { ProgressView() }
                            HStack {
                                DSButton(title: "Run OCR") { runOCR() }
                                DSButton(title: "Suggest title") { suggestTitle() }
                                DSButton(title: suggestBusy ? "Suggesting…" : "Suggest ideas") { suggestIdeas() }
                                    .disabled(suggestBusy)
                                    .opacity(suggestBusy ? 0.5 : 1)
                            }
                            if let t = suggestedTitle {
                                DSButton(title: "Use title: \(t)") {
                                    title = t
                                }
                            }
                            ForEach(suggestedIdeas, id: \.self) { idea in
                                DSButton(title: "Add idea: \(idea)") { addSuggestedIdea(idea) }
                            }
                            if let ocr = ocrResult {
                                Text(ocr).font(DS.reading(13)).lineSpacing(4)
                                DSButton(title: "Append OCR to text") {
                                    text = (text.isEmpty ? ocr : text + "\n\n" + ocr)
                                }
                            }
                        }
                        if let toast { Text(toast).font(DS.ui(12)).foregroundStyle(DS.muted) }
                    }
                }
                if editing || !linked.isEmpty {
                    Section("Linked notes") {
                        ForEach(linked, id: \.stableId) { n in
                            HStack {
                                NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                                    NoteRow(note: n)
                                }
                                if editing {
                                    DSButton(title: "Unlink") { unlink(n) }
                                }
                            }
                        }
                        if editing {
                            HStack {
                                TextField("Link by nick (e.g. n123456)", text: $linkNick)
                                DSButton(title: "Link") { linkByNick() }
                                    .disabled(linkNick.trimmingCharacters(in: .whitespaces).isEmpty)
                                    .opacity(linkNick.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                            }
                        }
                    }
                }
            } else if loaded {
                Text("Note not found — it may have been deleted.")
                    .foregroundStyle(.secondary)
            } else {
                LoadingBlock()
            }
        }
        .listStyle(.plain)
        .listRowSeparator(.hidden)
        .navigationTitle("Note")
        .interactiveDismissDisabled(dirty)
        .confirmationDialog("Discard unsaved changes?", isPresented: $confirmingDismiss) {
            Button("Discard", role: .destructive) { dismiss() }
            Button("Keep editing", role: .cancel) {}
        }
        .toolbar {
            if dirty {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { confirmingDismiss = true }
                }
            }
            #if os(macOS)
            ToolbarItem(placement: .primaryAction) {
                Button {
                    openWindow(value: noteId)
                } label: {
                    Label("Open in New Window", systemImage: "macwindow.badge.plus")
                }
                .help("Open this note in its own window")
            }
            #endif
        }
        .background { noteShortcutButtons }
        .onChange(of: editing) { nowEditing in
            // Entering edit mode lands in Title, ready to type (web
            // edit form focus), instead of leaving focus nowhere.
            if nowEditing {
                DispatchQueue.main.async { focusedField = .title }
            } else {
                focusedField = nil
            }
        }
        .task { load() }
    }

    /// Web note shortcuts (Help overlay, Note Editing): Ctrl+E/A/S/F/R,
    /// images, nick, delete, fields. Only the active mode's set is in
    /// the hierarchy, so read and edit shortcuts never collide.
    private var noteShortcutButtons: some View {
        Group {
            if editing {
                Button("") { save() }.keyboardShortcut("a", modifiers: [.control])
                Button("") { editing = false }.keyboardShortcut(.escape)
                Button("") { formatText() }.keyboardShortcut("f", modifiers: [.control])
                Button("") { suggestTitle() }.keyboardShortcut("s", modifiers: [.control])
                Button("") { runOCR() }.keyboardShortcut("r", modifiers: [.control])
                Button("") { fewerFields.toggle() }.keyboardShortcut("m", modifiers: [.control])
                Button("") { fewerFields = false }.keyboardShortcut("l", modifiers: [.control])
            } else {
                Button("") { beginEditing() }.keyboardShortcut("e", modifiers: [.control])
                Button("") { toggleStar() }.keyboardShortcut("s", modifiers: [.control])
                Button("") { confirming = true }.keyboardShortcut("#", modifiers: [.shift])
                Button("") { copyNick() }.keyboardShortcut("y", modifiers: [])
                Button("") { if !imageDatas.isEmpty { lightboxIndex = 0 } }
                    .keyboardShortcut("z", modifiers: [])
                Button("") { if !imageDatas.isEmpty { lightboxIndex = 0 } }
                    .keyboardShortcut("i", modifiers: [.control])
                Button("") { beginEditing(); fewerFields = false }
                    .keyboardShortcut("l", modifiers: [.control])
            }
            if lightboxIndex != nil {
                Button("") { lightboxIndex = max(0, (lightboxIndex ?? 1) - 1) }
                    .keyboardShortcut("j", modifiers: [.control])
                Button("") { lightboxIndex = min(imageDatas.count - 1, (lightboxIndex ?? -1) + 1) }
                    .keyboardShortcut("k", modifiers: [.control])
                Button("") { lightboxIndex = max(0, (lightboxIndex ?? 1) - 1) }
                    .keyboardShortcut(.leftArrow)
                Button("") { lightboxIndex = min(imageDatas.count - 1, (lightboxIndex ?? -1) + 1) }
                    .keyboardShortcut(.rightArrow)
            }
        }
        .hidden()
    }

    private func beginEditing() {
        guard let note else { return }
        title = note.title ?? ""; text = note.text ?? ""; take = note.take ?? ""
        urlField = note.url ?? ""; yearField = note.year.map(String.init) ?? ""; pageField = note.page ?? ""
        editing = true
    }

    private func copyNick() {
        guard let nick = note?.nick else { return }
        #if os(iOS)
        UIPasteboard.general.string = nick
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(nick, forType: .string)
        #endif
    }

    /// Edit-form field: small-caps label above a bordered input,
    /// like the web edit form (TITLE / TEXT / AUTHORS …).
    /// One tag in the read-mode link flow: the web's kind tags —
    /// small, square, kind-coloured text on the kind tint.
    private func linkTag(_ name: String, color: Color, tint: Color, italic: Bool = false) -> some View {
        Text(name)
            .font(DS.ui(11))
            .italic(italic)
            .foregroundStyle(color)
            .lineLimit(1)
            .padding(.horizontal, 6)
            .frame(height: 19)
            .background(tint)
            .overlay(RoundedRectangle(cornerRadius: 0).stroke(tint == .clear ? DS.hairline : Color.clear, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 0))
    }

    private func editField<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            DSLabel(text: label)
            content()
        }
    }

    private func formatText() {
        // Web Format-text: trim trailing space, collapse 3+ blank lines.
        text = text.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
            .joined(separator: "\n")
            .replacingOccurrences(of: "\n\n\n+", with: "\n\n", options: .regularExpression)
    }

    private func yearsLabel(_ a: Author) -> String? {
        if a.birth_year == nil && a.death_year == nil { return nil }
        return "\(a.birth_year.map(String.init) ?? "?")–\(a.death_year.map(String.init) ?? "")"
    }

    private var starred: Bool {
        state.pins.contains { $0.type == "note" && $0.id == noteId }
    }

    private func load() {
        Task {
            do {
                let rows = try await state.client.note(id: noteId)
                await MainActor.run {
                    note = rows.first; loaded = true; syncOptions(from: rows.first)
                    if editFirst, let n = rows.first {
                        title = n.title ?? ""; text = n.text ?? ""; take = n.take ?? ""
                        urlField = n.url ?? ""; yearField = n.year.map(String.init) ?? ""; pageField = n.page ?? ""
                        editing = true
                    }
                }
                do { _ = try await state.client.recordNoteOpened(id: noteId) }
                catch { await MainActor.run { self.toast = "Opened-count failed: \(describe(error))" } }
                do { let links = try await state.client.linkedNotes(noteId: noteId); await MainActor.run { linked = links } }
                catch { await MainActor.run { self.error = "Linked notes failed: \(describe(error))" } }
                loadImages()
            } catch {
                await MainActor.run { self.error = "Load failed: \(describe(error))"; loaded = true }
            }
        }
    }

    private func save() {
        Task {
            do {
                let updated = try await state.client.updateNote(
                    id: noteId, NoteUpdate(title: title, text: text, take: take,
                                           url: urlField.isEmpty ? nil : urlField,
                                           year: Int(yearField), page: pageField.isEmpty ? nil : pageField))
                await MainActor.run { note = updated; editing = false; syncOptions(from: updated) }
            } catch {
                await MainActor.run { self.error = "Save failed — still editing: \(describe(error))" }
            }
        }
    }

    private func remove() {
        Task {
            do { try await state.client.deleteNote(id: noteId); await MainActor.run { dismiss() } }
            catch { await MainActor.run { self.error = "Delete failed: \(describe(error))" } }
        }
    }

    private func loadImages() {
        // Fetch images concurrently; preserving index order matters
        // (lightbox and delete address images by position).
        Task {
            guard let count = note?.images?.count, count > 0 else { return }
            do {
                let datas = try await withThrowingTaskGroup(of: (Int, Data).self) { group in
                    for i in 1...count {
                        group.addTask { (i, try await state.client.noteImageData(noteId: noteId, index: i)) }
                    }
                    var collected: [(Int, Data)] = []
                    for try await pair in group { collected.append(pair) }
                    return collected.sorted { $0.0 < $1.0 }.map(\.1)
                }
                await MainActor.run { imageDatas = datas }
            } catch { await MainActor.run { self.error = "Images failed: \(describe(error))" } }
        }
    }

    private func uploadPhotos() {
        let items = photoItems
        guard !items.isEmpty else { return }
        uploading = true
        Task {
            do {
                for item in items {
                    guard let data = try await item.loadTransferable(type: Data.self), !data.isEmpty else { continue }
                    try await state.client.uploadNoteImage(noteId: noteId, data: data)
                    // Merge OCR text like the web multi-upload auto-OCR.
                    do {
                        let ocr = try await state.client.ocrText(noteId: noteId)
                        if !ocr.isEmpty { await MainActor.run { ocrResult = ocr } }
                    } catch { await MainActor.run { self.toast = "OCR after upload failed: \(describe(error))" } }
                }
                reloadNote()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { loadImages() }
            } catch { await MainActor.run { self.error = "Photo upload failed: \(describe(error))" } }
            await MainActor.run { photoItems = []; uploading = false }
        }
    }

    private func deleteImage(_ idx: Int) {
        guard let filename = note?.images?[idx] else { return }
        Task {
            do { try await state.client.deleteNoteImage(noteId: noteId, filename: filename); reloadNote(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { loadImages() } }
            catch { await MainActor.run { self.error = "Image delete failed: \(describe(error))" } }
        }
    }

    private func runOCR() {
        Task {
            do {
                let result = try await state.client.ocrText(noteId: noteId)
                await MainActor.run {
                    if result.isEmpty { toast = "No text found in images."; ocrResult = nil }
                    else { ocrResult = result }
                }
            } catch { await MainActor.run { self.error = "OCR failed: \(describe(error))" } }
        }
    }

    private func suggestTitle() {
        Task {
            do { let s = try await state.client.suggestTitle(noteId: noteId); await MainActor.run { suggestedTitle = s.suggested_title } }
            catch { await MainActor.run { self.error = "Title suggestion failed: \(describe(error))" } }
        }
    }

    private func suggestIdeas() {
        suggestBusy = true
        Task {
            do {
                let s = try await state.client.suggestIdeas(noteId: noteId)
                await MainActor.run {
                    suggestedIdeas = (s.suggested_ideas ?? []).filter { name in !ideaOptions.contains { $0.name.lowercased() == name.lowercased() } }
                }
            } catch { await MainActor.run { self.error = "Idea suggestions failed: \(describe(error))" } }
            await MainActor.run { suggestBusy = false }
        }
    }

    private func addSuggestedIdea(_ name: String) {
        Task {
            do { _ = try await state.client.createIdeaForNote(noteId: noteId, name: name); reloadNote() }
            catch { await MainActor.run { self.error = "Add idea failed: \(describe(error))" } }
        }
    }

    private func reloadLinked() {
        Task {
            do { let links = try await state.client.linkedNotes(noteId: noteId); await MainActor.run { linked = links } }
            catch { await MainActor.run { self.error = "Linked notes failed: \(describe(error))" } }
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
            do { try await state.client.unlinkNotes(a: noteId, b: other); reloadLinked() }
            catch { await MainActor.run { self.error = "Unlink failed: \(describe(error))" } }
        }
    }

    private func reloadNote() {
        Task {
            do { let rows = try await state.client.note(id: noteId); await MainActor.run { note = rows.first; syncOptions(from: rows.first) } }
            catch { await MainActor.run { self.error = "Reload failed: \(describe(error))" } }
        }
    }

    private func syncOptions(from n: Note?) {
        guard let n else { return }
        authorOptions = (n.authors ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
        peopleOptions = (n.people ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
        pileOptions = (n.piles ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
        ideaOptions = (n.ideas ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
    }

    private func savePeople() {
        let ids = peopleOptions.map(\.id)
        Task {
            do {
                let updated = try await state.client.updateNote(id: noteId, NoteUpdate(people: ids))
                await MainActor.run { note = updated; syncOptions(from: updated) }
            } catch { await MainActor.run { self.error = "About save failed: \(describe(error))" } }
        }
    }

    private func createPersonNamed(_ name: String) {
        Task {
            do {
                let a = try await state.client.createAuthor(name: name)
                guard let id = a._id else { await MainActor.run { self.error = "Person create returned no id." }; return }
                await MainActor.run { peopleOptions.append(PickOption(id: id, name: a.name ?? name)) }
                savePeople()
            } catch { await MainActor.run { self.error = "Person create failed: \(describe(error))" } }
        }
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
            do {
                let a = try await state.client.createAuthor(name: name)
                guard let id = a._id else { await MainActor.run { self.error = "Author create returned no id." }; return }
                await MainActor.run { authorOptions.append(PickOption(id: id, name: a.name ?? name)) }
                saveAuthors()
            } catch { await MainActor.run { self.error = "Author create failed: \(describe(error))" } }
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
