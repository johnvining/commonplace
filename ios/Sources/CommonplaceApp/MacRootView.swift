import SwiftUI
import CommonplaceKit

/// Split shell for wide screens (iPad landscape / Mac): sidebar
/// sections + detail, instead of the iPhone tab bar. Each section
/// reuses the same screens as iPhone.
struct MacRootView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.openWindow) private var openWindow
    @State private var section: String? = "notes"
    @State private var query = ""
    @State private var timePreselect: String?

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
            List(selection: $section) {
                Section {
                    ForEach(sections, id: \.id) { s in
                        Label(s.label, systemImage: s.icon).tag(s.id)
                    }
                }
                if !state.pins.isEmpty {
                    Section("Starred") {
                        ForEach(state.pins, id: \.id) { pin in
                            Button {
                                openPin(pin)
                            } label: {
                                HStack {
                                    Image(systemName: "star.fill")
                                        .font(DS.ui(10)).foregroundStyle(DS.muted)
                                    Text(pin.label ?? pin.id)
                                        .font(DS.ui(12)).lineLimit(1)
                                    if pin.pending == true {
                                        Text("pending").font(DS.ui(9)).foregroundStyle(DS.faint)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
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
    }

    private func openPin(_ pin: PinItem) {
        switch pin.type {
        case "note":
            openWindow(value: pin.id)
        case "pile":
            section = "piles"
        case "time":
            timePreselect = pin.id
            section = "time"
        case "work", "auth", "idea":
            section = pin.type == "work" ? "works" : pin.type == "auth" ? "authors" : "ideas"
        default:
            section = "starred"
        }
    }

    @ViewBuilder
    private var detail: some View {
        switch section ?? "notes" {
        case "time": TimeView(preselectSubject: timePreselect)
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
