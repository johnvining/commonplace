import SwiftUI
import CommonplaceKit

/// Starred items of every type, including time subjects
/// (mirrors the web sidebar stars + pins sync).
struct PinsView: View {
    @EnvironmentObject var state: AppState
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
            if let err = state.lastPinError { Text(err).font(DS.ui(12)).foregroundStyle(DS.danger) }
            let time = state.pins.filter { $0.type == "time" }
            let other = state.pins.filter { $0.type != "time" }
            if !time.isEmpty {
                Section {
                    ForEach(time, id: \.pinKey) { p in
                        HStack {
                            pinLabel(p)
                            Spacer()
                            unstarButton(p)
                        }
                    }
                }
            }
            Section {
                if other.isEmpty { Text("Nothing starred yet.").font(DS.ui(13)).foregroundStyle(DS.muted) }
                ForEach(other, id: \.pinKey) { p in
                    HStack {
                        pinDestination(p)
                        Spacer()
                        unstarButton(p)
                    }
                }
            }
        }
        .listStyle(.plain)
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
        HStack(spacing: 8) {
            Image(systemName: p.typeIcon)
                .font(DS.ui(13))
                .foregroundStyle(DS.muted)
                .frame(width: 18)
            Text(p.label ?? p.id)
                .font(p.type == "work" ? DS.serif(14).italic() : DS.serif(14))
                .foregroundStyle(DS.ink)
                .lineLimit(1)
        }
        .opacity(p.pending == true ? 0.6 : 1)
    }

    private func unstarButton(_ p: PinItem) -> some View {
        Button { unpin(p) } label: {
            Image(systemName: "star.fill").font(DS.ui(13)).foregroundStyle(DS.muted)
        }
        .buttonStyle(.plain)
        .help("Unstar")
    }

    private func unpin(_ p: PinItem) {
        state.queueUnpin(type: p.type, id: p.id)
        if let err = state.lastPinError { self.error = err }
    }
}

private extension PinItem {
    var pinKey: String { "\(type):\(id)" }
}
