import SwiftUI
import CommonplaceKit
#if os(macOS)
import AppKit

/// Captures the hosting NSWindow so section shortcuts can bring the
/// main window forward from anywhere in the app.
private struct WindowCapture: NSViewRepresentable {
    @Binding var window: NSWindow?

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async { window = view.window }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async { window = nsView.window }
    }
}
#endif

/// Split shell for wide screens (iPad landscape / Mac): sidebar
/// sections + detail, instead of the iPhone tab bar. Each section
/// reuses the same screens as iPhone.
struct MacRootView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.openWindow) private var openWindow
    @State private var section: String? = "notes"
    @State private var query = ""
    @State private var timePreselect: String?
    /// A starred item opened in this window: (type, id). Selecting a
    /// sidebar section clears it and returns to that section's list.
    @State private var routedType: String?
    @State private var routedId: String?
    #if os(macOS)
    @State private var mainWindow: NSWindow?
    #endif

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
        ("files", "Notes to file", "tray"),
        ("import", "Import", "square.and.arrow.down"),
        ("maintenance", "Maintenance", "wrench"),
        ("settings", "Settings", "gear"),
    ]

    private var timeSection: (id: String, label: String, icon: String) {
        sections.first { $0.id == "time" }!
    }

    private var mainSections: [(id: String, label: String, icon: String)] {
        sections.filter { $0.id != "time" }
    }

    private func sidebarRow(_ s: (id: String, label: String, icon: String)) -> some View {
        HStack(spacing: 6) {
            Label(s.label, systemImage: s.icon)
            Spacer()
            // Grey total beside countable sections.
            if let count = sectionCount(s.id) {
                Text("\(count)")
                    .font(DS.ui(11))
                    .monospacedDigit()
                    .foregroundStyle(DS.faint)
            }
            // Dot when maintenance has open tasks.
            if s.id == "maintenance", state.maintenancePending > 0 {
                Circle()
                    .fill(DS.accent)
                    .frame(width: 7, height: 7)
                    .help("\(state.maintenancePending) open maintenance tasks")
            }
        }
        .tag(s.id)
    }

    var body: some View {
        NavigationSplitView {
            List(selection: Binding(
                get: { section },
                set: { section = $0; routedType = nil; routedId = nil }
            )) {
                // Time sits alone at the top, like the website. The
                // app still opens on Notes below the break.
                Section {
                    sidebarRow(timeSection)
                }
                Section {
                    ForEach(mainSections, id: \.id) { s in
                        sidebarRow(s)
                    }
                }
                if !state.pins.isEmpty {
                    Section("Starred") {
                        ForEach(state.pins, id: \.id) { pin in
                            Button {
                                openPin(pin)
                            } label: {
                                HStack(spacing: 6) {
                                    // Fixed frame: symbols have different
                                    // intrinsic sizes, without it the text
                                    // column starts at a different x per row.
                                    Image(systemName: pin.typeIcon)
                                        .font(DS.ui(11)).foregroundStyle(DS.muted)
                                        .frame(width: 16, height: 16)
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
        .onChange(of: state.entityRoute) { route in
            guard let route else { return }
            state.entityRoute = nil
            if route.type == "find" {
                section = "search"; routedType = nil; routedId = nil
            } else {
                routedType = route.type == "author" ? "auth" : route.type
                routedId = route.id
            }
            #if os(macOS)
            NSApp.activate(ignoringOtherApps: true)
            mainWindow?.makeKeyAndOrderFront(nil)
            #endif
        }
        .onReceive(NotificationCenter.default.publisher(for: .macSection)) { note in
            if let s = note.object as? String {
                section = s; routedType = nil; routedId = nil
                // Bring this (main) window forward: menu shortcuts
                // (Ctrl+O, Cmd+1…) also fire while a detached note
                // window has focus, and switching an invisible window
                // reads as "shortcut doesn't work".
                #if os(macOS)
                NSApp.activate(ignoringOtherApps: true)
                mainWindow?.makeKeyAndOrderFront(nil)
                #endif
            }
        }
        #if os(macOS)
        .background(WindowCapture(window: $mainWindow))
        #endif
        // No animations anywhere: instant state changes.
        .transaction { $0.animation = nil }
    }

    /// Starred clicks open the item itself, in this window — not a new
    /// window, and not just the section's list.
    private func sectionCount(_ id: String) -> Int? {
        guard let c = state.counts else { return nil }
        switch id {
        case "notes": return c.notes
        case "works": return c.works
        case "authors": return c.authors
        case "ideas": return c.ideas
        case "piles": return c.piles
        default: return nil
        }
    }

    private func openPin(_ pin: PinItem) {
        switch pin.type {
        case "note", "pile", "work", "idea":
            routedType = pin.type
            routedId = pin.id
        case "auth", "author":
            routedType = "auth"
            routedId = pin.id
        case "time":
            routedType = nil; routedId = nil
            timePreselect = pin.id
            section = "time"
            // A starred time subject starts its timer on click (unless
            // one is already running — then just show the Time page).
            if !state.timerIsRunning {
                state.startTimer(key: pin.id, kind: state.timerKind, label: pin.label)
            }
        default:
            routedType = nil; routedId = nil
            section = "starred"
        }
    }

    @ViewBuilder
    private var detail: some View {
        if let routedType, let routedId {
            VStack(spacing: 0) {
                HStack {
                    Button {
                        self.routedType = nil; self.routedId = nil
                    } label: {
                        Label("Back", systemImage: "chevron.left")
                            .font(DS.ui(12, weight: .medium))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(DS.muted)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                NavigationStack {
                    switch routedType {
                    case "note": NoteDetailView(noteId: routedId)
                    case "pile": PileDetailView(pileId: routedId)
                    case "work": WorkDetailView(workId: routedId)
                    case "idea": IdeaDetailView(ideaId: routedId)
                    case "auth": AuthorDetailView(authorId: routedId)
                    default: PinsView()
                    }
                }
            }
        } else {
            sectionDetail
        }
    }

    @ViewBuilder
    private var sectionDetail: some View {
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
                // Clicking the display jumps to the Time section to
                // modify the running entry. Stop stays separate.
                Button {
                    NotificationCenter.default.post(name: .macSection, object: "time")
                } label: {
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
                    }
                }
                .buttonStyle(.plain)
                .help("Open the Time section")
                Spacer()
                Button("Stop") {
                    Task { await state.stopAndLogTimer() }
                }
                .controlSize(.small)
            }
            Button {
                NotificationCenter.default.post(name: .macSection, object: "time")
            } label: {
                KindSubjectLine(
                    kind: state.timerKind,
                    subject: subjectName.isEmpty ? (state.timerSubjectKey ?? "") : subjectName
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .help("Open the Time section")
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
