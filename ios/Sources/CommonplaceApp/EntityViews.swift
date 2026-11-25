import SwiftUI
import CommonplaceKit

// Works, authors, and ideas: recent lists with search, plus detail pages
// with their notes (and works, for authors/ideas). Mirrors the web entity
// pages at the speed-first level: one tap from search or More tab.

struct WorksListView: View {
    @EnvironmentObject var state: AppState
    @State private var works: [Work] = []
    @State private var query = ""
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            Section {
                TextField("Search works", text: $query).onSubmit { search() }
                Button("Search") { search() }
            }
            ForEach(works, id: \.stableId) { w in
                NavigationLink { WorkDetailView(workId: w._id ?? "") } label: {
                    VStack(alignment: .leading) {
                        Text(w.name ?? "(unnamed)")
                        if let y = w.year { Text(String(y)).font(.caption).foregroundStyle(.secondary) }
                    }
                }
            }
        }
        .navigationTitle("Works")
        .task { works = (try? await state.client.recentWorks()) ?? [] }
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
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            Section {
                TextField("Search authors", text: $query).onSubmit { search() }
                Button("Search") { search() }
            }
            ForEach(authors, id: \.stableId) { a in
                NavigationLink { AuthorDetailView(authorId: a._id ?? "") } label: {
                    Text(a.name ?? "(unnamed)")
                }
            }
        }
        .navigationTitle("Authors")
        .task { authors = (try? await state.client.recentAuthors()) ?? [] }
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
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            Section {
                TextField("Search ideas", text: $query).onSubmit { search() }
                Button("Search") { search() }
            }
            ForEach(ideas, id: \.stableId) { i in
                NavigationLink { IdeaDetailView(ideaId: i._id ?? "") } label: {
                    Text(i.name ?? "(unnamed)")
                }
            }
        }
        .navigationTitle("Ideas")
        .task { ideas = (try? await state.client.recentIdeas()) ?? [] }
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

    var body: some View {
        Form {
            if let error { Text(error).foregroundStyle(.red) }
            if let w = work {
                Section {
                    Text(w.name ?? "(unnamed)").font(.headline)
                    if let y = w.year { Text(String(y)).foregroundStyle(.secondary) }
                    if let u = w.url, !u.isEmpty { Text(u).font(.caption) }
                    if let authors = w.authors, !authors.isEmpty {
                        Text(authors.compactMap(\.name).joined(separator: ", ")).foregroundStyle(.secondary)
                    }
                    Button(starred ? "★ Starred" : "☆ Star") { toggleStar() }
                }
                Section("Notes") {
                    ForEach(notes, id: \.stableId) { n in
                        NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteRow(note: n) }
                    }
                }
            } else if loaded {
                Text("Work not found.").foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .navigationTitle("Work")
        .task { await load() }
    }

    private var starred: Bool { state.pins.contains { $0.type == "work" && $0.id == workId } }

    private func load() async {
        do {
            async let w = state.client.work(id: workId)
            async let n = state.client.workNotes(id: workId)
            let (ww, nn) = try await (w, n)
            work = ww; notes = nn; loaded = true
            _ = try? await state.client.recordWorkOpened(id: workId)
        } catch { self.error = "Load failed — retry."; loaded = true }
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

    var body: some View {
        Form {
            if let error { Text(error).foregroundStyle(.red) }
            if let a = author {
                Section {
                    Text(a.name ?? "(unnamed)").font(.headline)
                    if a.birth_year != nil || a.death_year != nil {
                        Text("\(a.birth_year.map(String.init) ?? "?") – \(a.death_year.map(String.init) ?? "")")
                            .foregroundStyle(.secondary)
                    }
                    Button(starred ? "★ Starred" : "☆ Star") { toggleStar() }
                }
                Section("Works") {
                    ForEach(works, id: \.stableId) { w in
                        NavigationLink { WorkDetailView(workId: w._id ?? "") } label: {
                            Text(w.name ?? "(unnamed)")
                        }
                    }
                }
                Section("Notes") {
                    ForEach(notes, id: \.stableId) { n in
                        NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteRow(note: n) }
                    }
                }
            } else if loaded {
                Text("Author not found.").foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .navigationTitle("Author")
        .task { await load() }
    }

    private var starred: Bool { state.pins.contains { $0.type == "auth" && $0.id == authorId } }

    private func load() async {
        do {
            async let a = state.client.author(id: authorId)
            async let w = state.client.authorWorks(id: authorId)
            async let n = state.client.authorNotes(id: authorId)
            let (aa, ww, nn) = try await (a, w, n)
            author = aa; works = ww; notes = nn; loaded = true
        } catch { self.error = "Load failed — retry."; loaded = true }
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

    var body: some View {
        Form {
            if let error { Text(error).foregroundStyle(.red) }
            if let i = idea {
                Section {
                    Text(i.name ?? "(unnamed)").font(.headline)
                    Button(starred ? "★ Starred" : "☆ Star") { toggleStar() }
                }
                Section("Works") {
                    ForEach(works, id: \.stableId) { w in
                        NavigationLink { WorkDetailView(workId: w._id ?? "") } label: {
                            Text(w.name ?? "(unnamed)")
                        }
                    }
                }
                Section("Notes") {
                    ForEach(notes, id: \.stableId) { n in
                        NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: { NoteRow(note: n) }
                    }
                }
            } else if loaded {
                Text("Idea not found.").foregroundStyle(.secondary)
            } else {
                Text("Loading…")
            }
        }
        .navigationTitle("Idea")
        .task { await load() }
    }

    private var starred: Bool { state.pins.contains { $0.type == "idea" && $0.id == ideaId } }

    private func load() async {
        do {
            async let i = state.client.idea(id: ideaId)
            async let w = state.client.ideaWorks(id: ideaId)
            async let n = state.client.ideaNotes(id: ideaId)
            let (ii, ww, nn) = try await (i, w, n)
            idea = ii; works = ww; notes = nn; loaded = true
        } catch { self.error = "Load failed — retry."; loaded = true }
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
