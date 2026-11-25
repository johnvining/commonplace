import SwiftUI

@main
struct CommonplaceApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup {
            if state.isSignedIn {
                ContentView()
                    .environmentObject(state)
            } else {
                LoginView()
                    .environmentObject(state)
            }
        }
    }
}
