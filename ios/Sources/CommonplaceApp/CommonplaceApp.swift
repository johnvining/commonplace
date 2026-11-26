import SwiftUI

@main
struct CommonplaceApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup {
            if state.authChecking && !state.isSignedIn {
                ProgressView("Checking session…").environmentObject(state)
            } else if state.isSignedIn {
                ContentView()
                    .environmentObject(state)
            } else {
                LoginView()
                    .environmentObject(state)
            }
        }
        // Mac: each note can live in its own window (Window > Merge All
        // Windows turns them into tabs, like document tabs).
        WindowGroup("Note", for: String.self) { $noteId in
            if let noteId, !noteId.isEmpty {
                NavigationStack {
                    NoteDetailView(noteId: noteId)
                }
                .environmentObject(state)
                .frame(minWidth: 420, minHeight: 480)
            }
        }
    }
}
