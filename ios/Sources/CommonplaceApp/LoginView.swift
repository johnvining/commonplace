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
                }
                Section("Password") {
                    SecureField("Password", text: $password)
                    Button(busy ? "Signing in…" : "Sign In") { signIn() }
                        .disabled(busy || password.isEmpty)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
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
            case .serverError: return "Server error — retry."
            case .clientError(_, let m): return m ?? "Sign-in failed."
            case .notFound(let m): return m ?? "Not found."
            case .decoding: return "Bad response — retry."
            }
        }
        return "Unreachable — check the server URL and retry."
    }
}
