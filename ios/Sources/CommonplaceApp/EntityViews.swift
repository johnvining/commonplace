import SwiftUI
import CommonplaceKit

// Works, authors, and ideas: recent lists with search, plus detail pages
// with their notes (and works, for authors/ideas). Mirrors the web entity
// pages at the speed-first level: one tap from search or More tab.

struct WorksListView: View {
    @EnvironmentObject var state: AppState
    @State private var works: [Work] = []
    @State private var query = ""
    @State private var searchTask: Task<Void, Never>?
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            Section {
                TextField("Search works", text: $query)
                    .font(DS.ui(14))
                    .onChange(of: query) { scheduleSearch() }
            }
            .listRowSeparator(.hidden)
            ForEach(works, id: \.stableId) { w in
                NavigationLink { WorkDetailView(workId: w._id ?? "") } label: {
                    EntityListRow(
                        name: w.name ?? "(unnamed)",
                        meta: [w.year.map(String.init), w.note_count.map { "\($0) notes" }].compactMap { $0 },
                        italicName: true
                    )
                }
            }
            .listRowSeparator(.hidden)
        }
        .listStyle(.plain)
        .navigationTitle("Works")
        .task { do { works = try await state.client.recentWorks() } catch { self.error = "Load failed: \(describe(error))" } }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            await MainActor.run { search() }
        }
    }

    private func search() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        Task {
            do { works = try await state.client.autocompleteWorks(q) }
            catch { self.error = "Search failed — retry." }
        }
    }
}

struct AuthorsListView: View {
    @EnvironmentObject var state: AppState
    @State private var authors: [Author] = []
    @State private var query = ""
    @State private var searchTask: Task<Void, Never>?
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            Section {
                TextField("Search authors", text: $query)
                    .font(DS.ui(14))
                    .onChange(of: query) { scheduleSearch() }
            }
            .listRowSeparator(.hidden)
            ForEach(authors, id: \.stableId) { a in
                NavigationLink { AuthorDetailView(authorId: a._id ?? "") } label: {
                    EntityListRow(
                        name: a.name ?? "(unnamed)",
                        meta: [a.note_count.map { "\($0) notes" }, a.work_count.map { "\($0) works" }].compactMap { $0 }
                    )
                }
            }
            .listRowSeparator(.hidden)
        }
        .listStyle(.plain)
        .navigationTitle("Authors")
        .task { do { authors = try await state.client.recentAuthors() } catch { self.error = "Load failed: \(describe(error))" } }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            await MainActor.run { search() }
        }
    }

    private func search() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        Task {
            do { authors = try await state.client.autocompleteAuthors(q) }
            catch { self.error = "Search failed — retry." }
        }
    }
}

struct IdeasListView: View {
    @EnvironmentObject var state: AppState
    @State private var ideas: [Idea] = []
    @State private var query = ""
    @State private var searchTask: Task<Void, Never>?
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            Section {
                TextField("Search ideas", text: $query)
                    .font(DS.ui(14))
                    .onChange(of: query) { scheduleSearch() }
            }
            .listRowSeparator(.hidden)
            ForEach(ideas, id: \.stableId) { i in
                NavigationLink { IdeaDetailView(ideaId: i._id ?? "") } label: {
                    EntityListRow(
                        name: i.name ?? "(unnamed)",
                        meta: [i.note_count.map { "\($0) notes" }].compactMap { $0 }
                    )
                }
            }
            .listRowSeparator(.hidden)
        }
        .listStyle(.plain)
        .navigationTitle("Ideas")
        .task { do { ideas = try await state.client.recentIdeas() } catch { self.error = "Load failed: \(describe(error))" } }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            await MainActor.run { search() }
        }
    }

    private func search() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        Task {
            do { ideas = try await state.client.autocompleteIdeas(q) }
            catch { self.error = "Search failed — retry." }
        }
    }
}

struct WorkDetailView: View {
    @EnvironmentObject var state: AppState
    let workId: String
    @State private var work: Work?
    @State private var notes: [Note] = []
    @State private var loaded = false
    @State private var error: String?
    @State private var editing = false
    @State private var editName = ""
    @State private var editYear = ""
    @State private var editURL = ""
    @State private var pileSel: [PickOption] = []
    @State private var ideaSel: [PickOption] = []
    @State private var confirmingDelete = false
    @State private var importText = ""
    @State private var newNoteId: String?
    @State private var showingNewNote = false
    @State private var nick: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            if let w = work {
                Section {
                    if editing {
                        TextField("Name", text: $editName)
                        TextField("Year", text: $editYear)
                        TextField("URL", text: $editURL)
                        Button("Save") { saveEdit() }
                    } else {
                        EntityPageHeader(
                            name: w.name ?? "(unnamed)",
                            italicName: true,
                            byline: w.year.map(String.init),
                            nick: nick
                        ) {
                            DSButton(title: starred ? "Starred" : "Star", selected: starred) { toggleStar() }
                            DSButton(title: "Edit") {
                                editName = w.name ?? ""; editYear = w.year.map(String.init) ?? ""; editURL = w.url ?? ""
                                editing = true
                            }
                            NavigationLink { ReadView(workId: workId, title: w.name ?? "Read") } label: {
                                DSButtonLabel(title: "Read")
                            }
                            .buttonStyle(.plain)
                            OpenInWebButton(path: "work/\(workId)")
                            DSButton(title: "Delete") { confirmingDelete = true }
                        }
                        .confirmationDialog("Delete this work?", isPresented: $confirmingDelete) {
                            Button("Delete", role: .destructive) { deleteWork() }
                        }
                        if let u = w.url, !u.isEmpty { Text(u).font(DS.ui(11)).foregroundStyle(DS.muted) }
                        if let eds = w.editors, !eds.isEmpty {
                            Text("Edited by \(eds.compactMap(\.name).joined(separator: ", "))").font(DS.ui(12)).foregroundStyle(DS.muted)
                        }
                        if let trs = w.translators, !trs.isEmpty {
                            Text("Translated by \(trs.compactMap(\.name).joined(separator: ", "))").font(DS.ui(12)).foregroundStyle(DS.muted)
                        }
                        if let cit = w.citation_information, !cit.isEmpty { Text(cit).font(DS.ui(12)) }
                        if let sum = w.summary, !sum.isEmpty { NoteText(text: sum, size: 13.5) }
                    }
                    if let authors = w.authors, !authors.isEmpty {
                        Text(authors.compactMap(\.name).joined(separator: ", "))
                            .font(DS.serif(13)).foregroundStyle(DS.muted)
                    }
                }
                .listRowSeparator(.hidden)
                if editing {
                    Section("Piles") {
                        PillEditor(
                            placeholder: "Add a pile…", tint: DS.pileSoft, selected: $pileSel,
                            load: { q in ((try? await state.client.autocompletePiles(q)) ?? []).compactMap { p in p._id.map { PickOption(id: $0, name: p.name ?? "") } } },
                            onAdd: { opt in pileSel.append(opt); Task { _ = try? await state.client.addPileToWork(workId: workId, pileId: opt.id); await load() } },
                            onRemove: { opt in pileSel.removeAll { $0.id == opt.id }; Task { _ = try? await state.client.removePileFromWork(workId: workId, pileId: opt.id); await load() } },
                            onCreateNew: { name in Task { _ = try? await state.client.createPileForWork(workId: workId, name: name); await load() } }
                        )
                    }
                    Section("Ideas") {
                        PillEditor(
                            placeholder: "Add an idea…", tint: DS.accentSoft, selected: $ideaSel,
                            load: { q in ((try? await state.client.autocompleteIdeas(q)) ?? []).compactMap { i in i._id.map { PickOption(id: $0, name: i.name ?? "") } } },
                            onAdd: { opt in ideaSel.append(opt); Task { _ = try? await state.client.addIdeaToWork(workId: workId, ideaId: opt.id); await load() } },
                            onRemove: { opt in ideaSel.removeAll { $0.id == opt.id }; Task { _ = try? await state.client.removeIdeaFromWork(workId: workId, ideaId: opt.id); await load() } },
                            onCreateNew: { name in Task { _ = try? await state.client.createIdeaForWork(workId: workId, name: name); await load() } }
                        )
                    }
                } else {
                    // Read mode: linked piles/ideas, unlabeled, tappable.
                    Section {
                        ForEach(w.piles ?? [], id: \.id) { p in
                            NavigationLink { PileDetailView(pileId: p.id) } label: {
                                Text(p.name ?? "").font(DS.serif(14.5)).foregroundStyle(DS.pile)
                            }
                        }
                        ForEach(w.ideas ?? [], id: \.id) { i in
                            NavigationLink { IdeaDetailView(ideaId: i.id) } label: {
                                Text(i.name ?? "").font(DS.serif(14.5)).foregroundStyle(DS.accent)
                            }
                        }
                    }
                    .listRowSeparator(.hidden)
                }
                Section("Notes") {
                    ForEach(notes, id: \.stableId) { n in
                        NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteRow(note: n) }
                    }
                    .listRowSeparator(.hidden)
                    if notes.count >= 500 { Button("Load more") { Task { await loadMoreNotes() } } }
                    HStack {
                        DSButton(title: "Add Note") { addNoteForWork() }
                        Spacer()
                    }
                    TextField("Import notes for this work…", text: $importText, axis: .vertical)
                    Button("Import notes") { importForWork() }.disabled(importText.isEmpty)
                }
                .navigationDestination(isPresented: $showingNewNote) {
                    NoteDetailView(noteId: newNoteId ?? "", editFirst: true)
                }
            } else if loaded {
                Text("Work not found.").foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .listStyle(.plain)
        .navigationTitle("Work")
        .task { await load() }
    }

    private func loadMoreNotes() async {
        do { notes += try await state.client.workNotes(id: workId, skip: notes.count, limit: 500) }
        catch { self.error = "Load more failed: \(describe(error))" }
    }

    private func deleteWork() {
        Task {
            do { try await state.client.deleteWork(id: workId); dismiss() }
            catch { self.error = "Delete failed: \(describe(error))" }
        }
    }

    private func addNoteForWork() {
        Task {
            do {
                let created = try await state.client.createNote(work: workId)
                guard let id = created._id else { self.error = "Create returned no id."; return }
                newNoteId = id; showingNewNote = true
            } catch { self.error = "Add note failed: \(describe(error))" }
        }
    }

    private func importForWork() {
        Task {
            do { try await state.client.importNotesForWork(workId: workId, notesText: importText); importText = ""; await load() }
            catch { self.error = "Import failed: \(describe(error))" }
        }
    }

    private var starred: Bool { state.pins.contains { $0.type == "work" && $0.id == workId } }

    private func saveEdit() {
        guard var w = work else { return }
        w.name = editName
        w.year = Int(editYear)
        w.url = editURL.isEmpty ? nil : editURL
        Task {
            do {
                work = try await state.client.updateWork(id: workId, w)
                editing = false
            } catch { self.error = "Save failed — retry." }
        }
    }

    private func load() async {
        do {
            async let w = state.client.work(id: workId)
            async let n = state.client.workNotes(id: workId)
            let (ww, nn) = try await (w, n)
            work = ww; notes = nn; loaded = true
            nick = await state.nick(type: "work", id: workId)
            pileSel = (ww.piles ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
            ideaSel = (ww.ideas ?? []).map { PickOption(id: $0.id, name: $0.name ?? "") }
            do { _ = try await state.client.recordWorkOpened(id: workId) }
            catch { self.error = "Opened-count failed: \(describe(error))" }
        } catch { self.error = "Load failed: \(describe(error))"; loaded = true }
    }

    private func toggleStar() {
        if starred { state.queueUnpin(type: "work", id: workId) }
        else { state.queuePin(type: "work", id: workId, label: work?.name, href: "/work/\(workId)") }
    }
}

struct AuthorDetailView: View {
    @EnvironmentObject var state: AppState
    let authorId: String
    @State private var author: Author?
    @State private var works: [Work] = []
    @State private var notes: [Note] = []
    @State private var loaded = false
    @State private var error: String?
    @State private var editing = false
    @State private var editName = ""
    @State private var editBirth = ""
    @State private var editDeath = ""
    @State private var confirmingDelete = false
    @State private var nick: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            if let a = author {
                Section {
                    if editing {
                        TextField("Name", text: $editName)
                        TextField("Birth year", text: $editBirth)
                        TextField("Death year", text: $editDeath)
                        Button("Save") { saveEdit() }
                    } else {
                        EntityPageHeader(
                            name: a.name ?? "(unnamed)",
                            byline: (a.birth_year != nil || a.death_year != nil)
                                ? "\(a.birth_year.map(String.init) ?? "?") – \(a.death_year.map(String.init) ?? "")"
                                : nil,
                            nick: nick
                        ) {
                            DSButton(title: starred ? "Starred" : "Star", selected: starred) { toggleStar() }
                            DSButton(title: "Edit") {
                                editName = a.name ?? ""
                                editBirth = a.birth_year.map(String.init) ?? ""
                                editDeath = a.death_year.map(String.init) ?? ""
                                editing = true
                            }
                            OpenInWebButton(path: "auth/\(authorId)")
                            DSButton(title: "Delete") { confirmingDelete = true }
                        }
                        .confirmationDialog("Delete this author?", isPresented: $confirmingDelete) {
                            Button("Delete", role: .destructive) { deleteAuthor() }
                        }
                    }
                }
                .listRowSeparator(.hidden)
                Section("Works") {
                    ForEach(works, id: \.stableId) { w in
                        NavigationLink { WorkDetailView(workId: w._id ?? "") } label: {
                            Text(w.name ?? "(unnamed)")
                        }
                    }
                }
                Section(header: Text("Notes — showing \(notes.count) of \(a.note_count ?? notes.count)")) {
                    ForEach(notes, id: \.stableId) { n in
                        NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteRow(note: n) }
                    }
                    .listRowSeparator(.hidden)
                    if notes.count >= 500 { Button("Load more") { Task { await loadMoreNotes() } } }
                }
            } else if loaded {
                Text("Author not found.").foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .listStyle(.plain)
        .navigationTitle("Author")
        .task { await load() }
    }

    private var starred: Bool { state.pins.contains { $0.type == "auth" && $0.id == authorId } }

    private func saveEdit() {
        guard var a = author else { return }
        a.name = editName
        a.birth_year = Int(editBirth)
        a.death_year = Int(editDeath)
        Task {
            do { author = try await state.client.updateAuthor(id: authorId, a); editing = false }
            catch { self.error = "Save failed — retry." }
        }
    }

    private func loadMoreNotes() async {
        do { notes += try await state.client.authorNotes(id: authorId, skip: notes.count, limit: 500) }
        catch { self.error = "Load more failed: \(describe(error))" }
    }

    private func deleteAuthor() {
        Task {
            do { try await state.client.deleteAuthor(id: authorId); dismiss() }
            catch { self.error = "Delete failed: \(describe(error))" }
        }
    }

    private func load() async {
        do {
            async let a = state.client.author(id: authorId)
            async let w = state.client.authorWorks(id: authorId)
            async let n = state.client.authorNotes(id: authorId)
            let (aa, ww, nn) = try await (a, w, n)
            author = aa; works = ww; notes = nn; loaded = true
            nick = await state.nick(type: "auth", id: authorId)
        } catch { self.error = "Load failed: \(describe(error))"; loaded = true }
    }

    private func toggleStar() {
        if starred { state.queueUnpin(type: "auth", id: authorId) }
        else { state.queuePin(type: "auth", id: authorId, label: author?.name, href: "/auth/\(authorId)") }
    }
}

struct IdeaDetailView: View {
    @EnvironmentObject var state: AppState
    let ideaId: String
    @State private var idea: Idea?
    @State private var works: [Work] = []
    @State private var notes: [Note] = []
    @State private var loaded = false
    @State private var error: String?
    @State private var editing = false
    @State private var editName = ""
    @State private var editStart = ""
    @State private var editEnd = ""
    @State private var editPerson = false
    @State private var confirmingDelete = false
    @State private var newNoteId: String?
    @State private var showingNewNote = false
    @State private var nick: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            if let i = idea {
                Section {
                    if editing {
                        TextField("Name", text: $editName)
                        TextField("Start year", text: $editStart)
                        TextField("End year", text: $editEnd)
                        Toggle("This idea is a person", isOn: $editPerson)
                        Button("Save") { saveEdit() }
                        Button("Cancel") { editing = false }
                    } else {
                        // Web entity-page-header: title left, quiet
                        // bordered toolbar buttons top-right, nick under.
                        EntityPageHeader(
                            name: i.name ?? "(unnamed)",
                            byline: [i.person == true ? "Person" : nil,
                                     i.start_year.map(String.init), i.end_year.map(String.init)]
                                .compactMap { $0 }.joined(separator: " • "),
                            nick: nick
                        ) {
                            DSButton(title: starred ? "Starred" : "Star", selected: starred) { toggleStar() }
                            DSButton(title: "Edit") {
                                editName = i.name ?? ""; editStart = i.start_year.map(String.init) ?? ""
                                editEnd = i.end_year.map(String.init) ?? ""; editPerson = i.person ?? false
                                editing = true
                            }
                            DSButton(title: "Add Note") { addNoteForIdea() }
                            OpenInWebButton(path: "idea/\(ideaId)")
                            DSButton(title: "Delete") { confirmingDelete = true }
                        }
                        .confirmationDialog("Delete this idea?", isPresented: $confirmingDelete) {
                            Button("Delete", role: .destructive) { deleteIdea() }
                        }
                        if let t = i.text, !t.isEmpty {
                            NoteText(text: t, size: 14.5)
                                .foregroundStyle(DS.ink)
                        }
                    }
                }
                .listRowSeparator(.hidden)
                if !works.isEmpty {
                    Section {
                        ForEach(works, id: \.stableId) { w in
                            NavigationLink { WorkDetailView(workId: w._id ?? "") } label: {
                                Text(w.name ?? "(unnamed)")
                                    .font(DS.serif(14.5)).italic()
                                    .foregroundStyle(DS.ink)
                            }
                        }
                    } header: {
                        Text("Works")
                    }
                }
                Section {
                    ForEach(notes, id: \.stableId) { n in
                        NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteFlowRow(note: n) }
                    }
                    if notes.count >= 500 { Button("Load more") { Task { await loadMoreNotes() } } }
                }
                .navigationDestination(isPresented: $showingNewNote) {
                    NoteDetailView(noteId: newNoteId ?? "", editFirst: true)
                }
            } else if loaded {
                Text("Idea not found.").foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .listStyle(.plain)
        .navigationTitle("Idea")
        .task { await load() }
    }

    private var starred: Bool { state.pins.contains { $0.type == "idea" && $0.id == ideaId } }

    private func saveEdit() {
        guard var i = idea else { return }
        i.name = editName; i.start_year = Int(editStart); i.end_year = Int(editEnd); i.person = editPerson
        Task {
            do { idea = try await state.client.updateIdea(id: ideaId, i); editing = false }
            catch { self.error = "Save failed: \(describe(error))" }
        }
    }

    private func deleteIdea() {
        Task { do { try await state.client.deleteIdea(id: ideaId); dismiss() } catch { self.error = "Delete failed: \(describe(error))" } }
    }

    private func loadMoreNotes() async {
        do { notes += try await state.client.ideaNotes(id: ideaId, skip: notes.count, limit: 500) }
        catch { self.error = "Load more failed: \(describe(error))" }
    }

    private func addNoteForIdea() {
        Task {
            do {
                let created = try await state.client.createNote()
                guard let id = created._id else { self.error = "Create returned no id."; return }
                _ = try await state.client.addIdeaToNote(noteId: id, ideaId: ideaId)
                newNoteId = id; showingNewNote = true
            } catch { self.error = "Add note failed: \(describe(error))" }
        }
    }

    private func load() async {
        do {
            async let i = state.client.idea(id: ideaId)
            async let w = state.client.ideaWorks(id: ideaId)
            async let n = state.client.ideaNotes(id: ideaId)
            let (ii, ww, nn) = try await (i, w, n)
            idea = ii; works = ww; notes = nn; loaded = true
            nick = await state.nick(type: "idea", id: ideaId)
        } catch { self.error = "Load failed: \(describe(error))"; loaded = true }
    }

    private func toggleStar() {
        if starred { state.queueUnpin(type: "idea", id: ideaId) }
        else { state.queuePin(type: "idea", id: ideaId, label: idea?.name, href: "/idea/\(ideaId)") }
    }
}

private extension Work {
    var stableId: String { _id ?? ["w", name].compactMap { $0 }.joined(separator: "|") }
}
private extension Author {
    var stableId: String { _id ?? ["a", name].compactMap { $0 }.joined(separator: "|") }
}
private extension Idea {
    var stableId: String { _id ?? ["i", name].compactMap { $0 }.joined(separator: "|") }
}
private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
