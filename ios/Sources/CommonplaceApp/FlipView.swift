import SwiftUI
import CommonplaceKit

/// Review deck (mirrors /flip): one note at a time, rate Fast/Med/Slow
/// to schedule its next review.
struct FlipView: View {
    @EnvironmentObject var state: AppState
    @State private var deck: [Note] = []
    @State private var index = 0
    @State private var error: String?
    @State private var done = false

    var body: some View {
        Form {
            if let error { Text(error).foregroundStyle(.red) }
            if done || index >= deck.count {
                Section { Text(deck.isEmpty ? "Nothing due for review." : "Deck finished — nice work.") }
                Section { Button("Load deck") { load() } }
            } else {
                let n = deck[index]
                Section {
                    Text(n.title ?? "(untitled)").font(.headline)
                    if let t = n.text, !t.isEmpty { Text(t) }
                    if let k = n.take, !k.isEmpty { Text(k).italic() }
                }
                Section("How soon again?") {
                    HStack {
                        Button("Fast") { rate("fast") }
                        Spacer()
                        Button("Med") { rate("med") }
                        Spacer()
                        Button("Slow") { rate("slow") }
                    }
                    Button("Skip") { index += 1 }
                }
                Section {
                    Text("\(index + 1) of \(deck.count)").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Review")
        .task { load() }
    }

    private func load() {
        done = false
        Task {
            do {
                deck = try await state.client.flipDeck()
                index = 0
            } catch { self.error = "Load failed — retry." }
        }
    }

    private func rate(_ rating: String) {
        guard index < deck.count, let id = deck[index]._id else { return }
        Task {
            _ = try? await state.client.reviewNote(id: id, rating: rating)
            await MainActor.run {
                index += 1
                if index >= deck.count { done = true }
            }
        }
    }
}
