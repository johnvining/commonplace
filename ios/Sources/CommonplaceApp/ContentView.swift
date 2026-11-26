import SwiftUI
import CommonplaceKit

/// Root tab bar. Web parity: Home/Recent (Notes), Time, Piles, Search, More.
struct ContentView: View {
    @EnvironmentObject var state: AppState

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
        TabView {
            NotesView()
                .tabItem { Label("Notes", systemImage: "note.text") }
            TimeView()
                .tabItem { Label("Time", systemImage: "timer") }
            PileListView()
                .tabItem { Label("Piles", systemImage: "tray.full") }
            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
            MoreView()
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .task {
            await state.validateSession()
            await state.refreshPins()
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
