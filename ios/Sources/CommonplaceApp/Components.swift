import SwiftUI
import CommonplaceKit

/// One selectable thing, by name — never by raw ID in the UI.
struct PickOption: Identifiable, Equatable {
    var id: String
    var name: String
}

/// Debounced typeahead matching the web PillInput contract: 2+ characters,
/// 250ms debounce, stale results ignored, an explicit Create row for the
/// typed name. Used for piles, ideas, authors, and works everywhere.
struct TypeaheadField: View {
    let placeholder: String
    var tint: Color = DS.accentSoft
    let load: (String) async -> [PickOption]
    let onPick: (PickOption) -> Void
    var onCreate: ((String) -> Void)? = nil
    var excludeIds: Set<String> = []

    @State private var query = ""
    @State private var matches: [PickOption] = []
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(placeholder, text: $query)
                .font(DS.ui(14))
                .autocorrectionDisabled()
                .onChange(of: query) { _ in scheduleSearch() }
            if !filtered.isEmpty || canCreate {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(filtered) { option in
                        Button {
                            onPick(option)
                            query = ""; matches = []
                        } label: {
                            Text(option.name)
                                .font(DS.ui(14))
                                .foregroundStyle(DS.ink)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 6)
                        }
                    }
                    if canCreate {
                        Button("Create “\(trimmed)”") {
                            onCreate?(trimmed)
                            query = ""; matches = []
                        }
                        .font(DS.ui(14, weight: .medium))
                        .foregroundStyle(DS.accent)
                    }
                }
            }
        }
    }

    private var trimmed: String { query.trimmingCharacters(in: .whitespaces) }
    private var filtered: [PickOption] { matches.filter { !excludeIds.contains($0.id) } }
    private var canCreate: Bool {
        onCreate != nil && trimmed.count >= 1 &&
            !filtered.contains { $0.name.lowercased() == trimmed.lowercased() }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let q = trimmed
        guard q.count >= 2 else { matches = []; return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if Task.isCancelled { return }
            let results = await load(q)
            if Task.isCancelled { return }
            await MainActor.run { matches = results }
        }
    }
}

/// Chips + typeahead for a multi-select (a note's piles/ideas, a work's
/// authors). The parent owns the API calls via onAdd/onRemove/onCreateNew.
struct PillEditor: View {
    let placeholder: String
    var tint: Color = DS.accentSoft
    @Binding var selected: [PickOption]
    let load: (String) async -> [PickOption]
    let onAdd: (PickOption) -> Void
    let onRemove: (PickOption) -> Void
    var onCreateNew: ((String) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !selected.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), alignment: .leading)], alignment: .leading, spacing: 6) {
                    ForEach(selected) { option in
                        HStack(spacing: 4) {
                            Text(option.name).font(DS.ui(12)).lineLimit(1)
                            Button("×") { onRemove(option) }
                                .font(DS.ui(12, weight: .bold))
                                .foregroundStyle(DS.muted)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(tint)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            TypeaheadField(
                placeholder: placeholder,
                tint: tint,
                load: load,
                onPick: onAdd,
                onCreate: onCreateNew,
                excludeIds: Set(selected.map(\.id))
            )
        }
    }
}
