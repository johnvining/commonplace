import SwiftUI
import CommonplaceKit

/// The quick bar (web `/` / Ctrl+O search overlay): type, arrow to a
/// result, Enter to open it — without leaving for the Search section.
/// One implementation for Mac and iOS; opens on Cmd+K.
struct QuickBarView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var items: [UnifiedSearchItem] = []
    @State private var highlighted = 0
    @State private var route: Route?
    @State private var searchTask: Task<Void, Never>?
    @FocusState private var focused: Bool

    private struct Route: Hashable {
        let type: String
        let id: String
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(DS.ui(13)).foregroundStyle(DS.faint)
                    TextField("Search notes, piles, works, authors, ideas…", text: $query)
                        .textFieldStyle(.plain)
                        .font(DS.ui(15))
                        .focused($focused)
                        .onChange(of: query) { scheduleSearch() }
                        .onSubmit { openHighlighted() }
                        .onKeyPress(.downArrow) { move(1); return .handled }
                        .onKeyPress(.upArrow) { move(-1); return .handled }
                    if !query.isEmpty {
                        Button { query = ""; items = [] } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(DS.faint)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                Divider()
                List {
                    ForEach(Array(items.enumerated()), id: \.element.stableRowId) { idx, item in
                        Button { open(item) } label: {
                            HStack(spacing: 8) {
                                Image(systemName: icon(for: item.type))
                                    .font(DS.ui(12)).foregroundStyle(DS.muted)
                                    .frame(width: 16, height: 16)
                                Text(item.displayName)
                                    .font(DS.serif(14.5, weight: .semibold))
                                    .foregroundStyle(DS.ink)
                                    .lineLimit(1)
                                Spacer()
                                Text((item.type ?? "").uppercased())
                                    .font(DS.ui(9, weight: .semibold)).tracking(0.7)
                                    .foregroundStyle(DS.faint)
                            }
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(idx == highlighted ? DS.hover : Color.clear)
                        .listRowSeparator(.hidden)
                    }
                    if items.isEmpty && query.trimmingCharacters(in: .whitespaces).count >= 2 {
                        Text("No results.").font(DS.ui(12)).foregroundStyle(DS.muted)
                            .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
            }
            .navigationTitle("Quick search")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .navigationDestination(item: $route) { r in
                destination(r)
            }
        }
        .frame(minWidth: 480, minHeight: 420)
        .task { focused = true }
    }

    @ViewBuilder
    private func destination(_ r: Route) -> some View {
        switch r.type {
        case "note": NoteDetailView(noteId: r.id)
        case "pile": PileDetailView(pileId: r.id)
        case "work": WorkDetailView(workId: r.id)
        case "idea": IdeaDetailView(ideaId: r.id)
        case "auth", "author": AuthorDetailView(authorId: r.id)
        default: Text("Can't open that here.")
        }
    }

    private func icon(for type: String?) -> String {
        switch type {
        case "note": return "note.text"
        case "pile": return "tray.full"
        case "work": return "book"
        case "auth", "author": return "person.2"
        case "idea": return "lightbulb"
        default: return "doc"
        }
    }

    private func move(_ delta: Int) {
        guard !items.isEmpty else { return }
        highlighted = min(max(0, highlighted + delta), items.count - 1)
    }

    private func openHighlighted() {
        guard items.indices.contains(highlighted) else { return }
        open(items[highlighted])
    }

    private func open(_ item: UnifiedSearchItem) {
        guard let id = item.itemId, let type = item.type else { return }
        route = Route(type: type, id: id)
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { items = []; return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 200_000_000)
            if Task.isCancelled { return }
            do {
                let rows = try await state.client.unifiedSearch(query: q, limit: 20)
                await MainActor.run { items = rows; highlighted = 0 }
            } catch {
                await MainActor.run { items = [] }
            }
        }
    }
}

private extension UnifiedSearchItem {
    var stableRowId: String { "\(type ?? "?"):\(itemId ?? displayName)" }
}
