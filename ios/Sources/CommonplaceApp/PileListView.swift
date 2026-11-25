import SwiftUI
import CommonplaceKit

/// All piles (mirrors /piles).
struct PileListView: View {
    @EnvironmentObject var state: AppState
    @State private var piles: [Pile] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                if let error { Text(error).foregroundStyle(.red) }
                ForEach(piles, id: \.stableId) { p in
                    NavigationLink { PileDetailView(pileId: p._id ?? "") } label: {
                        Text(p.name ?? "(unnamed)")
                    }
                }
            }
            .navigationTitle("Piles")
            .task { load() }
        }
    }

    private func load() {
        Task {
            do {
                piles = try await state.client.allPiles()
            } catch {
                await MainActor.run { error = "Load failed — retry." }
            }
        }
    }
}

private extension Pile {
    var stableId: String { _id ?? ["p", name].compactMap { $0 }.joined(separator: "|") }
}
