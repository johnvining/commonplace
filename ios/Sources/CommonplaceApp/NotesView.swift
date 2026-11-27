import SwiftUI
import CommonplaceKit

/// Recent notes list with keyword search + pile/idea filters
/// (mirrors RecentList + Filter AND semantics).
struct NotesView: View {
    var initialPile: PickOption? = nil
    @EnvironmentObject var state: AppState
    @Environment(\.openWindow) private var openWindow
    @State private var notes: [Note] = []
    @State private var page = 1
    @State private var search = ""
    @State private var searchTask: Task<Void, Never>?
    @State private var pileSel: [PickOption] = []
    @State private var ideaSel: [PickOption] = []
    @State private var error: String?
    @State private var newNoteId: String?
    @State private var showingNewNote = false
    @AppStorage("notesViewMode") private var viewMode = "slim"

    private var isCardMode: Bool { viewMode == "grid" || viewMode == "tile" }

    var body: some View {
        NavigationStack {
            // Both presentations stay mounted; switching formats only
            // toggles visibility, so grid/tile cards (markdown, images)
            // are pre-rendered and switching costs no rebuild at all.
            ZStack {
                listBody
                    .opacity(isCardMode ? 0 : 1)
                    .allowsHitTesting(!isCardMode)
                    .accessibilityHidden(isCardMode)
                cardBody
                    .opacity(isCardMode ? 1 : 0)
                    .allowsHitTesting(isCardMode)
                    .accessibilityHidden(!isCardMode)
            }
            .onReceive(NotificationCenter.default.publisher(for: .macNewNote)) { _ in
                createNote()
            }
            .navigationTitle("Notes")
            .navigationDestination(isPresented: $showingNewNote) {
                NoteDetailView(noteId: newNoteId ?? "", editFirst: true)
            }
            .toolbar {
                // Always visible, top right — not a row in the content.
                ToolbarItem(placement: .primaryAction) {
                    UnifiedViewSelector(mode: $viewMode)
                }
            }
            .task {
                // Seed from the session cache so coming back to Notes
                // is instant; the load below refreshes in place.
                if notes.isEmpty, initialPile == nil, !state.recentNotesCache.isEmpty {
                    notes = state.recentNotesCache
                }
                if let initialPile, pileSel.isEmpty { pileSel = [initialPile]; applySearch() } else { loadRecent() }
            }
        }
    }

    private var cardBody: some View {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            headerControls
                            if let error {
                                Text(error).font(DS.ui(12)).foregroundStyle(DS.danger)
                            }
                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: viewMode == "tile" ? 240 : 180), spacing: 12)],
                                alignment: .leading, spacing: 12
                            ) {
                                ForEach(notes, id: \.stableId) { n in
                                    NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                                        NoteCard(note: n, large: viewMode == "tile")
                                    }
                                    .buttonStyle(.plain)
                                    .contextMenu {
                                        #if os(macOS)
                                        Button("Open in New Window") {
                                            if let id = n._id { openWindow(value: id) }
                                        }
                                        #endif
                                    }
                                }
                            }
                            if notes.isEmpty && error == nil {
                                Text("No notes yet.").font(DS.ui(13)).foregroundStyle(DS.muted)
                            }
                            Button("Load more") { loadRecent(page: page + 1) }
                                .font(DS.ui(13))
                        }
                        .padding(16)
                    }
                    .refreshable { loadRecent() }
    }

    private var headerControls: some View {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        TextField("Search notes", text: $search)
                            .font(DS.ui(14))
                            .onSubmit { applySearch() }
                            .onChange(of: search) { scheduleSearch() }
                        // On Mac the app menu owns Cmd+N (it posts
                        // .macNewNote); a second shortcut here would
                        // create two notes per press.
                        // Borderless: in a List row, a default button
                        // can swallow taps meant for the filter
                        // controls sharing the row (#399).
                        #if os(macOS)
                        Button("＋ Note") { createNote() }
                            .font(DS.ui(13, weight: .medium))
                            .buttonStyle(.borderless)
                        #else
                        Button("＋ Note") { createNote() }
                            .keyboardShortcut("n", modifiers: .command)
                            .font(DS.ui(13, weight: .medium))
                            .buttonStyle(.borderless)
                        #endif
                    }
                    DisclosureGroup("Filter by pile / idea") {
                        VStack(alignment: .leading, spacing: 8) {
                            DSLabel(text: "Piles")
                            PillEditor(
                                placeholder: "Add a pile…",
                                tint: DS.pileSoft,
                                selected: $pileSel,
                                load: { q in
                                    ((try? await state.client.autocompletePiles(q)) ?? [])
                                        .compactMap { p in p._id.map { PickOption(id: $0, name: p.name ?? "") } }
                                },
                                onAdd: { pileSel.append($0); applySearch() },
                                onRemove: { opt in pileSel.removeAll { $0.id == opt.id }; applySearch() }
                            )
                            DSLabel(text: "Ideas")
                            PillEditor(
                                placeholder: "Add an idea…",
                                tint: DS.accentSoft,
                                selected: $ideaSel,
                                load: { q in
                                    ((try? await state.client.autocompleteIdeas(q)) ?? [])
                                        .compactMap { i in i._id.map { PickOption(id: $0, name: i.name ?? "") } }
                                },
                                onAdd: { ideaSel.append($0); applySearch() },
                                onRemove: { opt in ideaSel.removeAll { $0.id == opt.id }; applySearch() }
                            )
                            Button("Clear filters") {
                                search = ""; pileSel = []; ideaSel = []
                                page = 1; loadRecent()
                            }
                            .font(DS.ui(12))
                        }
                        .padding(.top, 6)
                    }
                    .font(DS.ui(13))
                    .foregroundStyle(DS.muted)
                }
    }

    private var listBody: some View {
        List {
            headerControls
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

            if let error {
                Text(error).font(DS.ui(12)).foregroundStyle(DS.danger)
                    .listRowSeparator(.hidden)
            }
            ForEach(notes, id: \.stableId) { n in
                NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                    NoteRow(note: n, full: viewMode == "full")
                }
                .contextMenu {
                    #if os(macOS)
                    Button("Open in New Window") {
                        if let id = n._id { openWindow(value: id) }
                    }
                    #endif
                }
                .listRowSeparatorTint(DS.hairline)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
            }
            if notes.isEmpty && error == nil {
                Text("No notes yet.").font(DS.ui(13)).foregroundStyle(DS.muted)
                    .listRowSeparator(.hidden)
            }
            Button("Load more") { loadRecent(page: page + 1) }
                .font(DS.ui(13))
                .listRowSeparator(.hidden)
        }
        .listStyle(.plain)
        .refreshable { loadRecent() }
    }

    private func createNote() {
        Task {
            do {
                let created = try await state.client.createNote()
                guard let id = created._id else { return }
                await MainActor.run { newNoteId = id; showingNewNote = true }
            } catch {
                await MainActor.run { self.error = "Could not create note — retry." }
            }
        }
    }

    private func loadRecent(page wanted: Int = 1) {
        Task {
            do {
                let rows = try await state.client.recentNotes(page: wanted)
                await MainActor.run {
                    page = wanted
                    notes = wanted == 1 ? rows : notes + rows
                    if wanted == 1 { state.recentNotesCache = rows }
                }
            } catch {
                await MainActor.run { self.error = "Load failed: \(describe(error))" }
            }
        }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            await MainActor.run { applySearch() }
        }
    }

    private func applySearch() {
        Task {
            do {
                let piles = pileSel.map(\.id)
                let ideas = ideaSel.map(\.id)
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
                await MainActor.run { self.error = "Search failed: \(describe(error))" }
            }
        }
    }
}

/// Human-readable API failure for list footers.
func describe(_ error: Error) -> String {
    if let api = error as? APIError {
        switch api {
        case .unauthorized(let m): return m ?? "signed out — log in again"
        case .forbidden(let m): return m ?? "forbidden"
        case .notFound(let m): return m ?? "not found"
        case .clientError(_, let m): return m ?? "request failed"
        case .serverError(let s, let m): return m ?? "server error \(s)"
        case .decoding(let d): return "bad response (\(d.prefix(90)))"
        case .transport(let t): return "unreachable (\(t.prefix(60)))"
        }
    }
    return error.localizedDescription
}

/// Card for Grid/Tile modes, web NoteTile parity: bounded card with a
/// title header, serif text preview, and tag pills that truncate on one
/// line instead of wrapping into one-letter columns.
struct NoteCard: View {
    let note: Note
    var large: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 6) {
                Text(note.displayTitle)
                    .font(DS.serif(15, weight: .semibold))
                    .foregroundStyle(DS.ink)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let imgs = note.images, !imgs.isEmpty {
                    HStack(spacing: 3) {
                        Image(systemName: "photo").font(DS.ui(10))
                        Text("\(imgs.count)")
                    }
                    .font(DS.ui(11)).foregroundStyle(DS.muted)
                }
            }
            if !note.displayAuthors.isEmpty {
                Text(note.displayAuthors.compactMap(\.name).joined(separator: ", "))
                    .font(DS.ui(11)).foregroundStyle(DS.muted).lineLimit(1)
            }
            if let imgs = note.images, !imgs.isEmpty, let noteId = note._id {
                HStack(spacing: 4) {
                    ForEach(1 ... min(imgs.count, 3), id: \.self) { i in
                        NoteImageThumb(noteId: noteId, index: i)
                            .frame(height: large ? 110 : 70)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                    if imgs.count > 3 {
                        Text("+\(imgs.count - 3)")
                            .font(DS.ui(11)).foregroundStyle(DS.muted)
                    }
                }
            }
            if (note.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) {
                NoteText(text: note.displayText, size: 13)
                    .foregroundStyle(DS.muted)
                    .lineLimit(large ? 6 : 3)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Spacer(minLength: 0)
            if (note.ideas?.isEmpty == false) || (note.piles?.isEmpty == false) {
                NoteTagRow(note: note)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: large ? 150 : 110, alignment: .topLeading)
        .background(DS.surface)
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(DS.hairline, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .contentShape(Rectangle())
    }
}

/// Flowing note row for entity pages, web slim parity: one serif
/// paragraph — authors, work in italics, bold title, then the text —
/// followed by square tag labels with coloured text (ideas blue,
/// piles purple), not filled pills.
struct NoteFlowRow: View {
    let note: Note

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            NoteFlowText(note: note, lines: 4)
            if (note.ideas?.isEmpty == false) || (note.piles?.isEmpty == false) {
                NoteTagRow(note: note)
            }
        }
        .padding(.vertical, 4)
    }

    private var flow: AttributedString {
        var md = ""
        var cite: [String] = []
        if !note.displayAuthors.isEmpty {
            cite.append(note.displayAuthors.compactMap(\.name).joined(separator: ", "))
        }
        if let w = note.work?.name, !w.isEmpty {
            cite.append("*\(w)*")
        }
        if !cite.isEmpty { md += cite.joined(separator: ", ") + ": " }
        let hasTitle = !(note.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        if hasTitle {
            md += "**\(note.displayTitle).** "
        }
        md += note.displayText
        if let attributed = try? AttributedString(markdown: md, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            return attributed
        }
        return AttributedString(md)
    }
}

/// Slim note row, web parity: authors + title on one line, one line of
/// serif preview, then idea/pile tags in their tints.
struct NoteRow: View {
    let note: Note
    var full: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .top, spacing: 6) {
                // One flowing serif paragraph, one size (web pattern).
                NoteFlowText(note: note, lines: full ? 10 : 3)
                if let imgs = note.images, !imgs.isEmpty {
                    HStack(spacing: 3) { Image(systemName: "photo").font(DS.ui(10)); Text("\(imgs.count)") }.font(DS.ui(11)).foregroundStyle(DS.muted)
                }
                if (note.openCount ?? 0) >= 5 {
                    Rectangle()
                        .fill(Color.orange.opacity((note.openCount ?? 0) >= 50 ? 0.95 : (note.openCount ?? 0) >= 20 ? 0.6 : 0.3))
                        .frame(width: 4)
                        .accessibilityLabel("Opened \(note.openCount ?? 0) times")
                }
            }
            if full { NoteStatusLine(note: note) }
            if (note.ideas?.isEmpty == false) || (note.piles?.isEmpty == false) {
                NoteTagRow(note: note)
            }
        }
        .padding(.vertical, 2)
    }
}

private extension Note {
    /// Stable across renders (no fresh UUID per evaluation).
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
