import SwiftUI
import CommonplaceKit

/// Starred items of every type, including time subjects
/// (mirrors the web sidebar stars + pins sync).
struct PinsView: View {
    @EnvironmentObject var state: AppState
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            if let err = state.lastPinError { Text(err).font(DS.ui(12)).foregroundStyle(DS.danger) }
            let time = state.pins.filter { $0.type == "time" }
            let other = state.pins.filter { $0.type != "time" }
            if !time.isEmpty {
                Section("Time subjects") {
                    ForEach(time, id: \.pinKey) { p in
                        HStack {
                            pinLabel(p)
                            Spacer()
                            Button("Unstar") { unpin(p) }
                        }
                    }
                }
            }
            Section("Starred") {
                if other.isEmpty { Text("Nothing starred yet.").font(DS.ui(13)).foregroundStyle(DS.muted) }
                ForEach(other, id: \.pinKey) { p in
                    HStack {
                        pinDestination(p)
                        Spacer()
                        Button("Unstar") { unpin(p) }
                    }
                }
            }
        }
        .navigationTitle("Starred")
        .refreshable { await state.refreshPins() }
        .task { await state.refreshPins() }
    }

    @ViewBuilder
    private func pinDestination(_ p: PinItem) -> some View {
        switch p.type {
        case "note":
            NavigationLink { NoteDetailView(noteId: p.id) } label: { pinLabel(p) }
        case "pile":
            NavigationLink { PileDetailView(pileId: p.id) } label: { pinLabel(p) }
        case "work":
            NavigationLink { WorkDetailView(workId: p.id) } label: { pinLabel(p) }
        case "idea":
            NavigationLink { IdeaDetailView(ideaId: p.id) } label: { pinLabel(p) }
        case "auth", "author":
            NavigationLink { AuthorDetailView(authorId: p.id) } label: { pinLabel(p) }
        default:
            pinLabel(p)
        }
    }

    private func pinLabel(_ p: PinItem) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if p.type == "pile", let label = p.label {
                    Text("Pile:").font(DS.ui(12)).foregroundStyle(DS.pile)
                    Text(label).font(DS.ui(14)).lineLimit(1)
                } else if p.type == "work" {
                    Text(p.label ?? p.id).font(DS.ui(14)).italic().lineLimit(1)
                } else {
                    Text(p.label ?? p.id).font(DS.ui(14)).lineLimit(1)
                }
                if p.pending == true {
                    Text("pending").font(DS.ui(10)).foregroundStyle(DS.muted)
                }
            }
            Text(p.type).font(.caption).foregroundStyle(.secondary)
        }
        .opacity(p.pending == true ? 0.6 : 1)
    }

    private func unpin(_ p: PinItem) {
        state.queueUnpin(type: p.type, id: p.id)
        if let err = state.lastPinError { self.error = err }
    }
}

private extension PinItem {
    var pinKey: String { "\(type):\(id)" }
}
