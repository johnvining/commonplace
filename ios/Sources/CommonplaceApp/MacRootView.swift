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
                    SidebarTimerView()
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

/// Running timer at the foot of the sidebar: live elapsed, subject,
/// kind, and Stop & log — visible from every section.
struct SidebarTimerView: View {
    @EnvironmentObject var state: AppState
    @State private var subjectName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "timer")
                    .font(DS.ui(12)).foregroundStyle(DS.accent)
                if let at = state.timerStartedAt {
                    TimelineView(.periodic(from: Date(), by: 1)) { ctx in
                        Text(formatElapsed(ctx.date.timeIntervalSince(at) * 1000))
                            .font(DS.ui(17, weight: .semibold))
                            .monospacedDigit()
                    }
                }
                Spacer()
                Button("Stop") {
                    Task { await state.stopAndLogTimer() }
                }
                .controlSize(.small)
            }
            Text("\(state.timerKind.capitalized) · \(subjectName.isEmpty ? (state.timerSubjectKey ?? "") : subjectName)")
                .font(DS.serif(12))
                .foregroundStyle(DS.muted)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(DS.hover)
        .overlay(Rectangle().fill(DS.hairline).frame(height: 1), alignment: .top)
        .task(id: state.timerSubjectKey) { await resolveSubject() }
    }

    private func resolveSubject() async {
        guard let key = state.timerSubjectKey else { return }
        if key.hasPrefix("title:") {
            subjectName = String(key.dropFirst(6))
            return
        }
        if key.hasPrefix("pile:") {
            let id = String(key.dropFirst(5))
            if let pile = try? await state.client.pile(id: id) {
                subjectName = pile.name ?? id
            }
            return
        }
        if key.hasPrefix("work:") {
            let id = String(key.dropFirst(5))
            if let work = try? await state.client.work(id: id) {
                subjectName = work.name ?? id
            }
            return
        }
        subjectName = key
    }
}
