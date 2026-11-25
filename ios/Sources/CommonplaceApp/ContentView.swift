import SwiftUI

/// Root tab bar. Web parity: Home/Recent (Notes), Time, Piles, Search, More.
struct ContentView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        TabView {
            TimeView()
                .tabItem { Label("Time", systemImage: "timer") }
            NotesView()
                .tabItem { Label("Notes", systemImage: "note.text") }
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

/// Overflow tab: starred pins + settings (mirrors the web sidebar stars).
struct MoreView: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink("Works") { WorksListView() }
                NavigationLink("Authors") { AuthorsListView() }
                NavigationLink("Ideas") { IdeasListView() }
                NavigationLink("Starred") { PinsView() }
                NavigationLink("Settings") { SettingsView() }
            }
            .navigationTitle("More")
        }
    }
}
