import SwiftUI

/// Server URL config + logout (mirrors web `logout` modifier).
struct SettingsView: View {
    @EnvironmentObject var state: AppState
    @State private var message: String?
    @State private var oldPassword = ""
    @State private var newPassword = ""

    var body: some View {
        List {
            Section {
                field("Server URL") {
                    TextField("Server URL", text: $state.serverURLString)
                        .dsInput().font(DS.mono(13))
                        .autocorrectionDisabled()
                    #if os(iOS)
                        .textInputAutocapitalization(.never)
                    #endif
                }
                field("Username") {
                    TextField("Username", text: $state.username)
                        .dsInput().font(DS.ui(13))
                        .autocorrectionDisabled()
                    #if os(iOS)
                        .textInputAutocapitalization(.never)
                    #endif
                }
                HStack {
                    DSButton(title: "Check session") {
                        Task {
                            await state.validateSession()
                            await MainActor.run {
                                message = state.isSignedIn ? "Session valid." : "Not signed in."
                            }
                        }
                    }
                    Spacer()
                }
            } header: { DSLabel(text: "Server") }

            Section {
                field("Current password") {
                    SecureField("Current password", text: $oldPassword)
                        .dsInput().font(DS.ui(13))
                }
                field("New password") {
                    SecureField("New password", text: $newPassword)
                        .dsInput().font(DS.ui(13))
                }
                HStack {
                    DSButton(title: "Change password") {
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
                    }
                    .disabled(oldPassword.isEmpty || newPassword.isEmpty)
                    .opacity(oldPassword.isEmpty || newPassword.isEmpty ? 0.5 : 1)
                    Spacer()
                }
            } header: { DSLabel(text: "Change password") }

            Section {
                HStack(spacing: 6) {
                    DSButton(title: "Log out") {
                        Task {
                            try? await state.client.logout()
                            await MainActor.run {
                                state.isSignedIn = false
                                message = "Logged out."
                            }
                        }
                    }
                    DSButton(title: "Log out everywhere") {
                        Task {
                            try? await state.client.logoutEverywhere()
                            await MainActor.run {
                                state.isSignedIn = false
                                message = "Logged out everywhere."
                            }
                        }
                    }
                    Spacer()
                }
            } header: { DSLabel(text: "Account") }

            if let message {
                Text(message).font(DS.ui(12)).foregroundStyle(DS.muted)
                    .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Settings")
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            DSLabel(text: label)
            content()
        }
        .listRowInsets(.standardRow)
        .listRowSeparator(.hidden)
    }
}
