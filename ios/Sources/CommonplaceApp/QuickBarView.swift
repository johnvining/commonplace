import SwiftUI
import CommonplaceKit

/// The quick bar — the web's Ctrl+O search bar, in the window: a dim
/// backdrop and a centred card, never a sheet. Keyword modifiers work
/// like the site's: type `auth`, `idea`, `work`, `read`, `pile` (or
/// `note`, `find`, `list`) and the word becomes a pill; suggestions run
/// for entity keywords, Enter applies the web's rules (exact name opens
/// it, otherwise a category search; a nick opens its entity; plain text
/// searches). Esc backs out of a keyword, then closes. Choosing
/// something navigates the main window; it does not open another one.
struct QuickBarView: View {
    @EnvironmentObject var state: AppState
    @State private var modifier = ""
    @State private var typedText = ""
    @State private var searchError = ""
    @State private var suggestions: [Suggestion] = []
    @State private var highlighted = 0
    @State private var route: Route?
    @State private var searchTask: Task<Void, Never>?
    @FocusState private var focused: Bool

    private struct Suggestion: Identifiable, Hashable {
        let id: String
        let name: String
        var isCreate: Bool = false
    }

    private struct Route: Hashable {
        let type: String
        let id: String
        var editFirst: Bool = false
    }

    private static let keywordModifiers = ["auth", "find", "idea", "list", "note", "pile", "work", "read"]
    private static let entityModifiers = ["auth", "idea", "work", "read", "pile"]

    private var dbType: String? {
        switch modifier {
        case "auth": return "auth"
        case "idea": return "idea"
        case "work", "read": return "work"
        case "pile": return "pile"
        default: return nil
        }
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                ZStack {
                    Color.black.opacity(0.7)
                        .ignoresSafeArea()
                        .onTapGesture { close() }
                    VStack(spacing: 0) {
                        bar
                        if !searchError.isEmpty {
                            Text(searchError)
                                .font(DS.ui(12)).foregroundStyle(DS.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 8)
                        }
                        if dbType != nil && !suggestions.isEmpty {
                            suggestionsList
                        }
                    }
                    .padding(.horizontal, 20).padding(.vertical, 18)
                    .frame(width: min(720, geo.size.width * 0.9))
                    .background(DS.surface)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(DS.hairline, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .shadow(color: .black.opacity(0.3), radius: 20, y: 4)
                }
            }
            .navigationDestination(item: $route) { r in destination(r) }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
        }
        .task { focused = true }
    }

    private var bar: some View {
        HStack(spacing: 0) {
            if !modifier.isEmpty {
                Text(modifier.uppercased())
                    .font(DS.ui(15, weight: .semibold))
                    .foregroundStyle(DS.surface)
                    .padding(.horizontal, 12)
                    .frame(height: 36)
                    .background(DS.ink)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                    .padding(.leading, 4)
            }
            TextField("", text: $typedText)
                .textFieldStyle(.plain)
                .font(DS.ui(16))
                .focused($focused)
                .autocorrectionDisabled()
                #if os(iOS)
                .textInputAutocapitalization(.never)
                #endif
                .padding(.horizontal, 10)
                .onChange(of: typedText) { onTextChange() }
                .onSubmit { execute() }
                .onKeyPress(.downArrow) { move(1); return .handled }
                .onKeyPress(.upArrow) { move(-1); return .handled }
                .onKeyPress(.escape) { escape(); return .handled }
                .onKeyPress(.delete) {
                    if typedText.isEmpty && !modifier.isEmpty {
                        typedText = modifier; modifier = ""; suggestions = []
                        return .handled
                    }
                    return .ignored
                }
            Button { close() } label: {
                Text("×").font(DS.ui(18)).foregroundStyle(DS.muted)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 6)
        }
        .frame(height: 44)
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(DS.hairline, lineWidth: 1))
    }

    private var suggestionsList: some View {
        VStack(spacing: 0) {
            ForEach(Array(suggestions.enumerated()), id: \.element.id) { idx, s in
                Button { pick(s) } label: {
                    HStack(spacing: 8) {
                        if s.isCreate {
                            Image(systemName: "plus").font(DS.ui(11)).foregroundStyle(DS.muted)
                        }
                        Text(s.isCreate ? "Create \u{201C}\(s.name)\u{201D}" : s.name)
                            .font(DS.serif(14, weight: .semibold))
                            .foregroundStyle(DS.ink).lineLimit(1)
                        Spacer()
                    }
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(idx == highlighted ? DS.hover : Color.clear)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private func destination(_ r: Route) -> some View {
        switch r.type {
        case "note": NoteDetailView(noteId: r.id, editFirst: r.editFirst)
        case "pile": PileDetailView(pileId: r.id)
        case "work": WorkDetailView(workId: r.id)
        case "idea": IdeaDetailView(ideaId: r.id)
        case "auth", "author": AuthorDetailView(authorId: r.id)
        default: Text("Can't open that here.")
        }
    }

    private func close() { state.quickBarOpen = false }

    private func escape() {
        if !modifier.isEmpty {
            typedText = modifier; modifier = ""; suggestions = []
        } else {
            close()
        }
    }

    private func move(_ delta: Int) {
        guard !suggestions.isEmpty else { return }
        highlighted = min(max(0, highlighted + delta), suggestions.count - 1)
    }

    private func onTextChange() {
        searchError = ""
        if modifier.isEmpty {
            let lower = typedText.lowercased()
            if Self.keywordModifiers.contains(lower) {
                modifier = lower
                typedText = ""
                return
            }
        }
        scheduleSuggestions()
    }

    private func scheduleSuggestions() {
        searchTask?.cancel()
        guard dbType != nil else { suggestions = []; return }
        let q = typedText.trimmingCharacters(in: .whitespaces)
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 200_000_000)
            if Task.isCancelled { return }
            do {
                let rows = try await fetchSuggestions(q)
                await MainActor.run {
                    suggestions = rows + (q.isEmpty ? [] : [Suggestion(id: "__create__", name: q, isCreate: true)])
                    highlighted = 0
                }
            } catch {
                await MainActor.run { suggestions = [] }
            }
        }
    }

    private func fetchSuggestions(_ q: String) async throws -> [Suggestion] {
        switch dbType {
        case "auth": return try await state.client.autocompleteAuthors(q).map { Suggestion(id: $0._id ?? "", name: $0.name ?? "") }
        case "idea": return try await state.client.autocompleteIdeas(q).map { Suggestion(id: $0._id ?? "", name: $0.name ?? "") }
        case "work": return try await state.client.autocompleteWorks(q).map { Suggestion(id: $0._id ?? "", name: $0.name ?? "") }
        case "pile": return try await state.client.autocompletePiles(q).map { Suggestion(id: $0._id ?? "", name: $0.name ?? "") }
        default: return []
        }
    }

    private func pick(_ s: Suggestion) {
        if s.isCreate {
            createEntity(name: s.name)
        } else if let type = dbType {
            navigate(type: type, id: s.id)
        }
    }

    private func createEntity(name: String) {
        guard let type = dbType else { return }
        Task {
            do {
                let id: String?
                switch type {
                case "auth": id = try await state.client.createAuthor(name: name)._id
                case "idea": id = try await state.client.createIdea(name: name)._id
                case "work": id = try await state.client.createWork(name: name)._id
                case "pile": id = try await state.client.createPile(name: name)._id
                default: id = nil
                }
                if let id { await MainActor.run { navigate(type: type, id: id) } }
            } catch { await MainActor.run { searchError = "Could not create that." } }
        }
    }

    /// Web navigation, in app terms: the main window shows the entity
    /// (Mac routes its split view; iOS pushes inside the overlay stack).
    private func navigate(type: String, id: String, editFirst: Bool = false) {
        #if os(macOS)
        state.entityRoute = AppState.QuickRoute(type: type, id: id)
        close()
        #else
        route = Route(type: type, id: id, editFirst: editFirst)
        #endif
    }

    private func find(_ query: String) {
        state.pendingFind = query
        navigate(type: "find", id: "")
    }

    private func execute() {
        if dbType != nil && suggestions.indices.contains(highlighted) && !typedText.isEmpty {
            let s = suggestions[highlighted]
            if !s.isCreate { pick(s); return }
        }
        let text = typedText.trimmingCharacters(in: .whitespaces)
        let normalized = text.lowercased()

        if modifier == "note" {
            guard !text.isEmpty else { return }
            Task {
                do {
                    let note = try await state.client.createNote(title: text)
                    if let id = note._id {
                        await MainActor.run { navigate(type: "note", id: id, editFirst: true) }
                    }
                } catch { await MainActor.run { searchError = "Could not create the note." } }
            }
            return
        }
        if modifier == "find" {
            guard !text.isEmpty else { return }
            find(text)
            return
        }
        if modifier.isEmpty && normalized == "logout" {
            Task {
                try? await state.client.logout()
                await MainActor.run { state.isSignedIn = false; close() }
            }
            return
        }
        if modifier.isEmpty && ["flip", "file", "home", "load", "maintenance"].contains(normalized) {
            let section = ["flip": "flip", "file": "files", "home": "notes", "load": "import", "maintenance": "maintenance"][normalized]!
            NotificationCenter.default.post(name: .macSection, object: section)
            close()
            return
        }
        if modifier == "list" && (normalized == "pile" || normalized == "piles") {
            NotificationCenter.default.post(name: .macSection, object: "piles")
            close()
            return
        }
        if ["slim", "full", "grid", "tile"].contains(normalized) {
            UserDefaults.standard.set(normalized, forKey: "notesViewMode")
            NotificationCenter.default.post(name: .macSection, object: "notes")
            close()
            return
        }
        if let type = dbType {
            // Exact name opens it; otherwise a search in that category.
            if let exact = suggestions.first(where: { !$0.isCreate && $0.name.lowercased() == normalized }) {
                navigate(type: type, id: exact.id)
            } else if !text.isEmpty {
                find("\(modifier): \(text)")
            }
            return
        }
        guard !text.isEmpty else { return }
        if text.range(of: #"^[nwipa][0-9]{6}$"#, options: .regularExpression) != nil {
            Task {
                do {
                    let nick = try await state.client.nickLookup(text)
                    await MainActor.run {
                        guard let nick, nick.retired != true else {
                            searchError = nick?.retired == true ? "That nick belonged to something deleted." : "Nick not found"
                            return
                        }
                        switch text.first {
                        case "n": if let v = nick.note { navigate(type: "note", id: v) }
                        case "w": if let v = nick.work { navigate(type: "work", id: v) }
                        case "i": if let v = nick.idea { navigate(type: "idea", id: v) }
                        case "p": if let v = nick.pile { navigate(type: "pile", id: v) }
                        case "a": if let v = nick.auth { navigate(type: "auth", id: v) }
                        default: searchError = "Nick not found"
                        }
                    }
                } catch { await MainActor.run { searchError = "Nick not found" } }
            }
            return
        }
        find(text)
    }
}
