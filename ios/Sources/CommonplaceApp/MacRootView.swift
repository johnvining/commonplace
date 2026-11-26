import SwiftUI
import CommonplaceKit

/// Split shell for wide screens (iPad landscape / Mac): sidebar
/// sections + detail, instead of the iPhone tab bar. Each section
/// reuses the same screens as iPhone.
struct MacRootView: View {
    @EnvironmentObject var state: AppState
    @State private var section: String? = "notes"
    @State private var query = ""

    private let sections: [(id: String, label: String, icon: String)] = [
        ("notes", "Notes", "note.text"),
        ("time", "Time", "timer"),
        ("piles", "Piles", "tray.full"),
        ("works", "Works", "book"),
        ("authors", "Authors", "person.2"),
        ("ideas", "Ideas", "lightbulb"),
        ("search", "Search", "magnifyingglass"),
        ("flip", "Review", "rectangle.stack"),
        ("starred", "Starred", "star"),
        ("files", "Files", "folder"),
        ("import", "Import", "square.and.arrow.down"),
        ("maintenance", "Maintenance", "wrench"),
        ("settings", "Settings", "gear"),
    ]

    var body: some View {
        NavigationSplitView {
            List(sections, id: \.id, selection: $section) { s in
                Label(s.label, systemImage: s.icon).tag(s.id)
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 210, max: 260)
            .safeAreaInset(edge: .bottom) {
                if state.timerIsRunning {
                    Text("Timing \(state.timerKind)…")
                        .font(DS.ui(11)).foregroundStyle(DS.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                }
            }
        } detail: {
            detail
                .frame(minWidth: 560, minHeight: 480)
        }
        .searchable(text: $query, placement: .toolbar, prompt: "Search (use Search section for nicks)")
    }

    @ViewBuilder
    private var detail: some View {
        switch section ?? "notes" {
        case "time": TimeView()
        case "piles": PileListView()
        case "works": WorksListView()
        case "authors": AuthorsListView()
        case "ideas": IdeasListView()
        case "search": SearchView()
        case "flip": FlipView()
        case "starred": PinsView()
        case "files": FileListView()
        case "import": ImportView()
        case "maintenance": MaintenanceView()
        case "settings": SettingsView()
        default: NotesView()
        }
    }
}
