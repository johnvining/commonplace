import SwiftUI

/// Server URL config + logout (mirrors web `logout` modifier).
struct SettingsView: View {
    @EnvironmentObject var state: AppState
    @State private var message: String?
    @State private var oldPassword = ""
    @State private var newPassword = ""

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
            Section("Change password") {
                SecureField("Current password", text: $oldPassword)
                SecureField("New password", text: $newPassword)
                Button("Change password") {
                    Task {
                        do {
                            _ = try await state.client.changePassword(
                                username: state.username, oldPassword: oldPassword, newPassword: newPassword)
                            await MainActor.run {
                                message = "Password changed."
                                oldPassword = ""; newPassword = ""
                            }
                        } catch {
                            await MainActor.run { message = "Change failed — check the current password." }
                        }
                    }
                }.disabled(oldPassword.isEmpty || newPassword.isEmpty)
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
