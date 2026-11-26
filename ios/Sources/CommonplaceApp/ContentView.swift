import SwiftUI
import CommonplaceKit

/// Root tab bar. Web parity: Home/Recent (Notes), Time, Piles, Search, More.
struct ContentView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var tab = 0
    @State private var timePreselect: String?

    var body: some View {
        VStack(spacing: 0) {
            if state.unreachable {
                HStack {
                    Text("Server unreachable — showing last known data.")
                        .font(DS.ui(12)).foregroundStyle(DS.danger)
                    Spacer()
                    Button("Retry") { Task { await state.validateSession(); await state.refreshPins() } }
                        .font(DS.ui(12, weight: .medium))
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(DS.hover)
            }
            if state.authChecking {
                Text("Checking session…").font(DS.ui(11)).foregroundStyle(DS.muted)
            }
        tabView
        }
    }

    private var tabView: some View {
        Group {
        if sizeClass == .regular {
            MacRootView()
        } else {
        TabView(selection: $tab) {
            NotesView()
                .tabItem { Label("Notes", systemImage: "note.text") }
                .tag(0)
            TimeView(preselectSubject: timePreselect)
                .tabItem { Label("Time", systemImage: "timer") }
                .tag(1)
            PileListView()
                .tabItem { Label("Piles", systemImage: "tray.full") }
                .tag(2)
            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
                .tag(3)
            MoreView()
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
                .tag(4)
        }
        }
        }
        .task {
            await state.validateSession()
            await state.refreshPins()
            consumePendingRoute()
        }
        .onChange(of: state.isSignedIn) { if state.isSignedIn { consumePendingRoute() } }
        // commonplace://time?subject=pile:<id> | title:<slug>
        .onOpenURL { url in openDeepLink(url) }
    }

    /// Restore where the user was when the session dropped (401), or a
    /// time-subject deep link, once signed in.
    private func consumePendingRoute() {
        guard state.isSignedIn, let route = state.pendingRoute, !route.isEmpty else { return }
        state.pendingRoute = nil
        applyRoute(route)
    }

    private func openDeepLink(_ url: URL) {
        guard url.scheme == "commonplace" else { return }
        if url.host == "time" {
            let subject = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "subject" })?.value
            applyRoute(subject.map { "time?subject=\($0)" } ?? "time")
        }
    }

    private func applyRoute(_ route: String) {
        if route.hasPrefix("time") {
            tab = 1
            if let q = route.split(separator: "?", maxSplits: 1).last, route.contains("subject=") {
                timePreselect = String(q).replacingOccurrences(of: "subject=", with: "")
            }
            return
        }
        switch route {
        case "piles": tab = 2
        case "search": tab = 3
        case "more": tab = 4
        default: tab = 0
        }
    }
}

/// Overflow tab: counts, entity lists, starred pins + settings.
struct MoreView: View {
    @EnvironmentObject var state: AppState
    @State private var counts: StatsCounts?
    @State private var countsError: String?

    var body: some View {
        NavigationStack {
            List {
                if let countsError { Text(countsError).font(DS.ui(12)).foregroundStyle(DS.danger) }
                if let c = counts {
                    Section("Library") {
                        NavigationLink { NotesView() } label: { Text("Notes: \(c.notes ?? 0)") }
                        NavigationLink { AuthorsListView() } label: { Text("Authors: \(c.authors ?? 0)") }
                        NavigationLink { IdeasListView() } label: { Text("Ideas: \(c.ideas ?? 0)") }
                        NavigationLink { WorksListView() } label: { Text("Works: \(c.works ?? 0)") }
                        NavigationLink { PileListView() } label: { Text("Piles: \(c.piles ?? 0)") }
                    }
                }
                NavigationLink("Works") { WorksListView() }
                NavigationLink("Authors") { AuthorsListView() }
                NavigationLink("Ideas") { IdeasListView() }
                NavigationLink("Review (Flip)") { FlipView() }
                NavigationLink("Notes to file") { FileListView() }
                NavigationLink("Import / Load") { ImportView() }
                NavigationLink("Maintenance") { MaintenanceView() }
                NavigationLink("Starred") { PinsView() }
                NavigationLink("Help & shortcuts") { HelpView() }
                NavigationLink("Settings") { SettingsView() }
            }
            .navigationTitle("More")
            .task {
                do { counts = try await state.client.stats() }
                catch { countsError = "Stats failed: \(describe(error))" }
            }
        }
    }
}

/// Keyboard shortcuts and gestures (mirrors the web HelpOverlay).
struct HelpView: View {
    var body: some View {
        List {
            Section("Everywhere (hardware keyboard)") {
                Text("⌘N — new note (Notes tab)").font(DS.ui(13))
                Text("Pull down — refresh lists").font(DS.ui(13))
            }
            Section("Notes") {
                Text("Tap a note to open it; ☆ stars it from its page. Piles and ideas are pill editors — type 2+ letters, tap a match, or Create.").font(DS.ui(13))
            }
            Section("Time") {
                Text("Pick a starred/recent subject (or name something new), choose Reading or Writing, Start. Stop logs to today; a failed stop keeps the timer running.").font(DS.ui(13))
            }
            Section("Search") {
                Text("Type to search everything, or paste a nick like n123456 / p123456. Tap a nick anywhere to copy it.").font(DS.ui(13))
            }
        }
        .navigationTitle("Help")
    }
}
