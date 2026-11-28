import SwiftUI
import CommonplaceKit

/// One pile: header, time-on-pile totals with Time-log link, works + notes
/// (mirrors site/Pile.tsx).
struct PileDetailView: View {
    @EnvironmentObject var state: AppState
    let pileId: String
    @State private var pile: Pile?
    @State private var notes: [Note] = []
    @State private var works: [Work] = []
    @State private var timeTotals: (total: Int, reading: Int, writing: Int, count: Int)?
    @State private var error: String?
    @State private var newName = ""
    @State private var editing = false
    @State private var confirmingDelete = false
    @State private var newNoteId: String?
    @State private var showingNewNote = false
    @State private var showingNarrow = false
    @State private var notesOnly = false
    @State private var nick: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            Section {
                if editing {
                    DSLabel(text: "Name")
                    TextField("Name", text: $newName)
                        .dsInput()
                        .font(DS.ui(14))
                    HStack(spacing: 6) {
                        DSButton(title: "Done") { saveName() }
                        DSButton(title: "Cancel") { editing = false }
                        Spacer()
                    }
                } else {
                    // Web entity header: title + nick left, standard
                    // buttons top-right, nothing at the bottom.
                    EntityPageHeader(
                        name: pile?.name ?? "",
                        byline: [pile?.start_year.map(String.init), pile?.end_year.map(String.init)]
                            .compactMap { $0 }.joined(separator: " • "),
                        nick: nick,
                        splitPilePrefix: true
                    ) {
                        DSButton(title: starred ? "Starred" : "Star", selected: starred) { toggleStar() }
                        DSButton(title: "Edit") {
                            newName = pile?.name ?? ""
                            editing = true
                        }
                        DSButton(title: "Add Note") { addNote() }
                        NavigationLink {
                            NotesView(initialPile: PickOption(id: pileId, name: pile?.name ?? "Pile"))
                        } label: {
                            DSButtonLabel(title: "Narrow")
                        }
                        .buttonStyle(.plain)
                        OpenInWebButton(path: "pile/\(pileId)")
                        DSButton(title: "Delete") { confirmingDelete = true }
                    }
                    .confirmationDialog("Delete this pile?", isPresented: $confirmingDelete) {
                        Button("Delete", role: .destructive) { deletePile() }
                    }
                }
                // One quiet line, only when there is time (web parity).
                if let t = timeTotals, t.count > 0 {
                    HStack(spacing: 6) {
                        Text("Time on this pile: \(formatMinutes(t.reading)) reading + \(formatMinutes(t.writing)) writing = \(formatMinutes(t.total)) total (\(t.count) \(t.count == 1 ? "entry" : "entries"))")
                            .font(DS.ui(12)).foregroundStyle(DS.muted)
                        NavigationLink { TimeView(preselectSubject: TimeSubjectKey.pileKey(pileId: pileId)) } label: {
                            Text("Open in Time log").font(DS.ui(12)).foregroundStyle(DS.accent)
                        }
                        .buttonStyle(.plain)
                    }
                }
                if !editing, let overview = pile?.text, !overview.isEmpty {
                    DSLabel(text: "Overview")
                    NoteText(text: overview, size: 14.5)
                }
            }
            .listRowSeparator(.hidden)
            if !works.isEmpty && !notesOnly {
                Section {
                    ForEach(works, id: \.stableId) { w in
                        NavigationLink { WorkDetailView(workId: w._id ?? "") } label: {
                            WorkListRow(work: w)
                        }
                    }
                    .listRowSeparator(.hidden)
                }
            }
            Section {
                ForEach(notes, id: \.stableId) { n in
                    NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                        NoteFlowRow(note: n)
                    }
                }
                if notes.count >= 500 { DSButton(title: "Load more") { loadMoreNotes() } }
            }
            .navigationDestination(isPresented: $showingNewNote) {
                NoteDetailView(noteId: newNoteId ?? "")
            }
            .navigationDestination(isPresented: $showingNarrow) {
                NotesView(initialPile: PickOption(id: pileId, name: pile?.name ?? "Pile"))
            }
        }
        .listStyle(.plain)
        .background {
            EntityShortcutButtons(
                editing: editing,
                onEdit: { newName = pile?.name ?? ""; editing = true },
                onSave: saveName,
                onExitEdit: { editing = false },
                onToggleStar: toggleStar,
                onDelete: { confirmingDelete = true },
                onNewNote: addNote,
                onViewNotes: { notesOnly.toggle() },
                onNarrow: { showingNarrow = true }
            )
        }
        .navigationTitle("Pile")
        .task { load() }
    }

    private var starred: Bool {
        state.pins.contains { $0.type == "pile" && $0.id == pileId }
    }

    private func load() {
        Task {
            do {
                async let p = state.client.pile(id: pileId)
                async let n = state.client.pileNotes(id: pileId)
                async let w = state.client.pileWorks(id: pileId)
                let (pp, nn, ww) = try await (p, n, w)
                let fetched = await state.nick(type: "pile", id: pileId)
                await MainActor.run { nick = fetched }
                // Time totals are decoration: a failure there must not
                // take down the whole pile page (#403).
                let tt = (try? await state.client.listTimeEntries(pile: pileId, limit: 1000)) ?? []
                let r = tt.filter { $0.kind == "reading" }.reduce(0) { $0 + ($1.minutes ?? 0) }
                let wr = tt.filter { $0.kind == "writing" }.reduce(0) { $0 + ($1.minutes ?? 0) }
                await MainActor.run {
                    pile = pp; notes = nn; works = ww
                    timeTotals = (tt.reduce(0) { $0 + ($1.minutes ?? 0) }, r, wr, tt.count)
                }
            } catch {
                await MainActor.run { self.error = "Load failed: \(describe(error))" }
            }
        }
    }

    private func saveName() {
        Task {
            var update = Pile()
            update.name = newName
            do {
                let saved = try await state.client.updatePile(id: pileId, update)
                await MainActor.run { pile = saved; editing = false }
            } catch {
                await MainActor.run { self.error = "Save failed — still editing: \(describe(error))" }
            }
        }
    }

    private func loadMoreNotes() {
        Task {
            do { let more = try await state.client.pileNotes(id: pileId, skip: notes.count, limit: 500); await MainActor.run { notes += more } }
            catch { await MainActor.run { self.error = "Load more failed: \(describe(error))" } }
        }
    }

    private func addNote() {
        Task {
            do {
                let created = try await state.client.createNote()
                guard let id = created._id else { return }
                _ = try await state.client.addPileToNote(noteId: id, pileId: pileId)
                await MainActor.run { newNoteId = id; showingNewNote = true }
            } catch {
                await MainActor.run { self.error = "Could not create note — retry." }
            }
        }
    }

    private func deletePile() {
        Task {
            do {
                try await state.client.deletePile(id: pileId)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { self.error = "Delete failed — retry." }
            }
        }
    }

    private func toggleStar() {
        if starred {
            state.queueUnpin(type: "pile", id: pileId)
        } else {
            state.queuePin(type: "pile", id: pileId,
                           label: pile?.name, href: "/pile/\(pileId)")
        }
    }
}

private extension Work {
    var stableId: String { _id ?? ["w", name].compactMap { $0 }.joined(separator: "|") }
}

private extension Note {
    var stableId: String { _id ?? ["n", title, text].compactMap { $0 }.joined(separator: "|") }
}
