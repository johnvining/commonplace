import SwiftUI
import CommonplaceKit

/// Root tab bar. Web parity: Home/Recent (Notes), Time, Piles, Search, More.
struct ContentView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
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

    var body: some View {
        NavigationStack {
            List {
                if let c = counts {
                    Section("Library") {
                        Text("\(c.notes ?? 0) notes · \(c.authors ?? 0) authors · \(c.ideas ?? 0) ideas · \(c.works ?? 0) works · \(c.piles ?? 0) piles")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                NavigationLink("Works") { WorksListView() }
                NavigationLink("Authors") { AuthorsListView() }
                NavigationLink("Ideas") { IdeasListView() }
                NavigationLink("Review (Flip)") { FlipView() }
                NavigationLink("Import") { ImportView() }
                NavigationLink("Maintenance") { MaintenanceView() }
                NavigationLink("Starred") { PinsView() }
                NavigationLink("Settings") { SettingsView() }
            }
            .navigationTitle("More")
            .task { counts = try? await state.client.stats() }
        }
    }
}
