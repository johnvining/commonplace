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
    @State private var loaded = false

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger).listRowSeparator(.hidden) }
            if !loaded {
                LoadingBlock()
            } else if done || index >= deck.count {
                Section { Text(deck.isEmpty ? "Nothing due for review." : "Deck finished — nice work.").font(DS.ui(13)).foregroundStyle(DS.muted) }
                Section { DSButton(title: "Load deck") { load() } }
            } else {
                let n = deck[index]
                Section {
                    NoteStatusLine(note: n)
                    Text(n.displayTitle).font(DS.noteTitle()).tracking(-0.075).foregroundStyle(DS.ink)
                    if let t = n.text, !t.isEmpty {
                        NoteText(text: t)
                        if let k = n.take, !k.isEmpty {
                            HStack(alignment: .top, spacing: 0) {
                                Rectangle().fill(DS.hairline).frame(width: 2)
                                Text(k).font(DS.reading(14)).italic().foregroundStyle(DS.muted).lineSpacing(5).padding(.leading, 10)
                            }
                        }
                    } else {
                        Text(n.displayText).font(DS.reading(15)).foregroundStyle(DS.ink).lineSpacing(5)
                    }
                    if let id = n._id {
                        NavigationLink { NoteDetailView(noteId: id, editFirst: true) } label: { Text("Edit in place") }
                    }
                }
                Section("How soon again?") {
                    HStack(spacing: 6) {
                        Text("See again:").font(DS.ui(12)).foregroundStyle(DS.muted)
                        DSButton(title: "Fast") { rate("fast") }
                        DSButton(title: "Med") { rate("med") }
                        DSButton(title: "Slow") { rate("slow") }
                        Spacer()
                        DSButton(title: "‹ Prev") { if index > 0 { index -= 1 } }
                            .disabled(index == 0).opacity(index == 0 ? 0.5 : 1)
                        DSButton(title: "Skip") { index += 1 }
                    }.disabled(rating)
                    Text("\(index + 1) of \(deck.count)")
                        .font(DS.ui(12)).monospacedDigit().foregroundStyle(DS.muted)
                }
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .listRowSeparator(.hidden)
        .navigationTitle("Review")
        .background {
            Group {
                Button("") { rate("fast") }.keyboardShortcut("1", modifiers: [])
                Button("") { rate("med") }.keyboardShortcut("2", modifiers: [])
                Button("") { rate("slow") }.keyboardShortcut("3", modifiers: [])
                Button("") {
                    if index + 1 >= deck.count { done = true } else { index += 1 }
                }.keyboardShortcut("n", modifiers: [])
                Button("") { if index > 0 { index -= 1 } }.keyboardShortcut("p", modifiers: [])
                Button("") { if done || index >= deck.count { load() } }
                    .keyboardShortcut(.return)
            }
            .hidden()
        }
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
                loaded = true
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
