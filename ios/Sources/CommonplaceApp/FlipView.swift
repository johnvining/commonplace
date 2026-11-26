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
    @State private var rating = false

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            if done || index >= deck.count {
                Section { Text(deck.isEmpty ? "Nothing due for review." : "Deck finished — nice work.") }
                Section { Button("Load deck") { load() } }
            } else {
                let n = deck[index]
                Section {
                    NoteStatusLine(note: n)
                    Text(n.title ?? "(untitled)").font(.headline)
                    if let t = n.text, !t.isEmpty { NoteText(text: t) }
                    if let k = n.take, !k.isEmpty { Text(k).italic() }
                    if let id = n._id {
                        NavigationLink { NoteDetailView(noteId: id, editFirst: true) } label: { Text("Edit in place") }
                    }
                }
                Section("How soon again?") {
                    HStack {
                        Button("Fast") { rate("fast") }
                        Spacer()
                        Button("Med") { rate("med") }
                        Spacer()
                        Button("Slow") { rate("slow") }
                    }.disabled(rating)
                    HStack {
                        Button("‹ Prev") { if index > 0 { index -= 1 } }.disabled(index == 0)
                        Spacer()
                        Button("Skip") { index += 1 }
                    }
                }
                Section {
                    Text("\(index + 1) of \(deck.count)").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Review")
        .refreshable { load() }
        .task { load() }
        .onAppear { if !deck.isEmpty { load() } }
    }

    private func load() {
        done = false
        Task {
            do {
                deck = try await state.client.flipDeck()
                index = 0
                error = nil
            } catch { self.error = "Load failed: \(describe(error))" }
        }
    }

    private func rate(_ ratingValue: String) {
        guard !rating, index < deck.count, let id = deck[index]._id else { return }
        rating = true
        Task {
            do {
                _ = try await state.client.reviewNote(id: id, rating: ratingValue)
                await MainActor.run {
                    index += 1
                    if index >= deck.count { done = true }
                    rating = false
                }
            } catch {
                await MainActor.run { self.error = "Rating failed — not advanced: \(describe(error))"; rating = false }
            }
        }
    }
}
