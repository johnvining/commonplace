import SwiftUI

/// Server URL config + logout (mirrors web `logout` modifier).
struct SettingsView: View {
    @EnvironmentObject var state: AppState
    @State private var message: String?

    var body: some View {
        Form {
            Section("Server") {
                TextField("Server URL", text: $state.serverURLString)
                    .autocorrectionDisabled()
                #if os(iOS)
                    .textInputAutocapitalization(.never)
                #endif
                TextField("Username", text: $state.username)
                    .autocorrectionDisabled()
                #if os(iOS)
                    .textInputAutocapitalization(.never)
                #endif
                Button("Check session") {
                    Task {
                        await state.validateSession()
                        await MainActor.run {
                            message = state.isSignedIn ? "Session valid." : "Not signed in."
                        }
                    }
                }
            }
            Section("Account") {
                Button("Log out") {
                    Task {
                        try? await state.client.logout()
                        await MainActor.run {
                            state.isSignedIn = false
                            message = "Logged out."
                        }
                    }
                }
                Button("Log out everywhere") {
                    Task {
                        try? await state.client.logoutEverywhere()
                        await MainActor.run {
                            state.isSignedIn = false
                            message = "Logged out everywhere."
                        }
                    }
                }
            }
            if let message { Section { Text(message) } }
        }
        .navigationTitle("Settings")
    }
}
