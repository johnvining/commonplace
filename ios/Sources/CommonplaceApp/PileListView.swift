import SwiftUI
import CommonplaceKit

/// All piles (mirrors /piles).
struct PileListView: View {
    @EnvironmentObject var state: AppState
    @State private var piles: [Pile] = []
    @State private var error: String?
    @State private var newName = ""
    @State private var newPileId: String?
    @State private var showingNew = false

    var body: some View {
        NavigationStack {
            List {
                if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
                Section {
                    HStack {
                        TextField("New pile name", text: $newName)
                            .font(DS.ui(14))
                        Button("Create") { create() }.disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .listRowSeparator(.hidden)
                ForEach(piles, id: \.stableId) { p in
                    NavigationLink { PileDetailView(pileId: p._id ?? "") } label: {
                        EntityListRow(
                            name: p.name ?? "(unnamed)",
                            meta: [p.note_count.map { "\($0) notes" }, p.work_count.map { "\($0) works" }].compactMap { $0 }
                        )
                    }
                }
                .listRowSeparator(.hidden)
            }
            .refreshable { load() }
            .navigationTitle("Piles")
            .navigationDestination(isPresented: $showingNew) {
                PileDetailView(pileId: newPileId ?? "")
            }
            .task { load() }
        }
    }

    private func create() {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            do {
                let pile = try await state.client.createPile(name: name)
                await MainActor.run { newName = ""; newPileId = pile._id; showingNew = pile._id != nil }
                load()
            } catch {
                await MainActor.run { self.error = "Create failed — retry." }
            }
        }
    }

    private func load() {
        Task {
            do {
                piles = try await state.client.allPiles()
            } catch {
                await MainActor.run { self.error = "Load failed — retry." }
            }
        }
    }
}

private extension Pile {
    var stableId: String { _id ?? ["p", name].compactMap { $0 }.joined(separator: "|") }
}
