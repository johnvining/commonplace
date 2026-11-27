import SwiftUI
import CommonplaceKit

/// Sign-in screen. Mirrors the web single-password form (site/Login.tsx):
/// secure password field, error banner, retry on unreachable.
struct LoginView: View {
    @EnvironmentObject var state: AppState
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Commonplace")
                        .font(DS.ui(22, weight: .semibold)).foregroundStyle(DS.ink)
                    VStack(alignment: .leading, spacing: 4) {
                        DSLabel(text: "Server URL")
                        TextField("Server URL", text: $state.serverURLString)
                            .dsInput().font(DS.mono(13))
                            .autocorrectionDisabled()
                        #if os(iOS)
                            .textInputAutocapitalization(.never)
                        #endif
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        DSLabel(text: "Username")
                        TextField("Username", text: $state.username)
                            .dsInput().font(DS.ui(13))
                            .autocorrectionDisabled()
                        #if os(iOS)
                            .textInputAutocapitalization(.never)
                        #endif
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        DSLabel(text: "Password")
                        SecureField("Password", text: $password)
                            .dsInput().font(DS.ui(13))
                            .onSubmit { signIn() }
                    }
                    if let error {
                        Text(error).font(DS.ui(12)).foregroundStyle(DS.danger)
                    }
                    HStack {
                        DSButton(title: busy ? "Signing in…" : "Sign In") { signIn() }
                            .disabled(busy || password.isEmpty)
                            .opacity(busy || password.isEmpty ? 0.5 : 1)
                        Spacer()
                    }
                }
                .padding(24)
                .frame(maxWidth: 420, alignment: .leading)
                .background(DS.surface)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(DS.hairline, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .listRowInsets(EdgeInsets(top: 32, leading: 24, bottom: 24, trailing: 24))
                .listRowSeparator(.hidden)
                .frame(maxWidth: .infinity, alignment: .center)
            }
            .listStyle(.plain)
            .navigationTitle("Commonplace")
        }
    }

    private func signIn() {
        busy = true
        self.error = nil
        Task {
            do {
                _ = try await state.client.login(username: state.username, password: password)
                await MainActor.run {
                    state.isSignedIn = true
                    state.authError = nil
                    busy = false
                    password = ""
                }
                await state.refreshPins()
            } catch {
                await MainActor.run {
                    self.error = friendly(error)
                    busy = false
                }
            }
        }
    }

    private func friendly(_ failure: Error) -> String {
        if let api = failure as? APIError {
            switch api {
            case .unauthorized, .forbidden: return "Incorrect password."
            case .transport: return "Unreachable — check the server URL and retry."
            case .serverError(let status, _):
                return status >= 500 ? "Server unavailable — try again in a moment." : "Server error — retry."
            case .clientError(let status, let m):
                if status == 429 { return "Too many tries — wait a bit and retry." }
                if (400...403).contains(status) { return "Incorrect password." }
                return m ?? "Sign-in failed."
            case .notFound(let m): return m ?? "Not found."
            case .decoding: return "Bad response — retry."
            }
        }
        return "Unreachable — check the server URL and retry."
    }
}
