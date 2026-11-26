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
    }
}
