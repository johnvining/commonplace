import SwiftUI

@main
struct CommonplaceApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup {
            Group {
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
            .sheet(isPresented: $state.quickBarOpen) {
                QuickBarView().environmentObject(state)
            }
            .task {
                await state.validateSession()
                if state.isSignedIn {
                    await state.refreshPins()
                    await state.refreshCounts()
                    await state.refreshMaintenancePending()
                    await state.syncRunningTimer()
                    state.startTimerPolling()
                }
            }
        }
        .commands {
            #if os(macOS)
            CommandGroup(replacing: .newItem) {
                Button("New Note") {
                    NotificationCenter.default.post(name: .macNewNote, object: nil)
                }
                .keyboardShortcut("n", modifiers: .command)
            }
            CommandMenu("View") {
                Button("Notes") { NotificationCenter.default.post(name: .macSection, object: "notes") }
                    .keyboardShortcut("1", modifiers: .command)
                Button("Time") { NotificationCenter.default.post(name: .macSection, object: "time") }
                    .keyboardShortcut("2", modifiers: .command)
                Button("Piles") { NotificationCenter.default.post(name: .macSection, object: "piles") }
                    .keyboardShortcut("3", modifiers: .command)
                Button("Quick Search…") { state.quickBarOpen = true }
                    .keyboardShortcut("k", modifiers: .command)
            }
            CommandMenu("Time") {
                Button(state.timerIsRunning ? "Stop Timer" : "Start from Time section") {
                    if state.timerIsRunning {
                        Task { await state.stopAndLogTimer() }
                    }
                }
                .keyboardShortcut("t", modifiers: [.command, .shift])
                .disabled(!state.timerIsRunning)
            }
            #endif
        }
        #if os(macOS)
        MenuBarExtra {
            MenuTimerView()
                .environmentObject(state)
        } label: {
            MenuTimerLabel()
                .environmentObject(state)
        }
        .menuBarExtraStyle(.window)
        #endif
        // Mac: each note can live in its own window (Window > Merge All
        // Windows turns them into tabs, like document tabs).
        #if os(macOS)
        Settings {
            SettingsView()
                .environmentObject(state)
                .frame(width: 460)
        }
        #endif
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
