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
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            if let error { Text(error).foregroundStyle(.red) }
            Section {
                if editing {
                    TextField("Name", text: $newName)
                    Button("Save") { saveName() }
                } else {
                    Text(pile?.name ?? "Loading…").font(.headline)
                }
                HStack {
                    Button(starred ? "★ Starred" : "☆ Star") { toggleStar() }
                    Button(editing ? "Cancel" : "Edit") {
                        newName = pile?.name ?? ""
                        editing.toggle()
                    }
                }
            }
            Section("Time on this pile") {
                if let t = timeTotals {
                    Text("\(formatMinutes(t.reading)) + \(formatMinutes(t.writing)) = \(formatMinutes(t.total)) (\(t.count) entries)")
                } else {
                    Text("Loading…")
                }
            }
            Section("Works") {
                ForEach(works, id: \.stableId) { w in
                    Text(w.name ?? "(unnamed)")
                }
            }
            Section("Notes") {
                ForEach(notes, id: \.stableId) { n in
                    NavigationLink { NoteDetailView(noteId: n._id ?? "") } label: {
                        NoteRow(note: n)
                    }
                }
                HStack {
                    Button("Add Note") { addNote() }
                    Spacer()
                    Button("Delete Pile") { confirmingDelete = true }
                        .foregroundStyle(.red)
                        .confirmationDialog("Delete this pile?", isPresented: $confirmingDelete) {
                            Button("Delete", role: .destructive) { deletePile() }
                        }
                }
            }
            .navigationDestination(isPresented: $showingNewNote) {
                NoteDetailView(noteId: newNoteId ?? "")
            }
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
                async let t = state.client.listTimeEntries(pile: pileId, limit: 1000)
                let (pp, nn, ww, tt) = try await (p, n, w, t)
                let r = tt.filter { $0.kind == "reading" }.reduce(0) { $0 + ($1.minutes ?? 0) }
                let wr = tt.filter { $0.kind == "writing" }.reduce(0) { $0 + ($1.minutes ?? 0) }
                await MainActor.run {
                    pile = pp; notes = nn; works = ww
                    timeTotals = (tt.reduce(0) { $0 + ($1.minutes ?? 0) }, r, wr, tt.count)
                }
            } catch {
                await MainActor.run { self.error = "Load failed — retry." }
            }
        }
    }

    private func saveName() {
        Task {
            var update = Pile()
            update.name = newName
            if let saved = try? await state.client.updatePile(id: pileId, update) {
                await MainActor.run { pile = saved; editing = false }
            }
        }
    }

    private func addNote() {
        Task {
            do {
                let created = try await state.client.createNote()
                guard let id = created._id else { return }
                _ = try? await state.client.addPileToNote(noteId: id, pileId: pileId)
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
