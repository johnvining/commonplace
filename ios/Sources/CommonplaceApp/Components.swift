import SwiftUI
import CommonplaceKit
#if os(iOS)
import UIKit
#endif

/// Tap-to-copy nick with a 2s check (web ClickToCopyNick, tap-only on iOS).
struct CopyNickButton: View {
    let nick: String
    @State private var copied = false
    var body: some View {
        Button {
            #if os(iOS)
            UIPasteboard.general.string = nick
            #endif
            copied = true
            Task { try? await Task.sleep(nanoseconds: 2_000_000_000); copied = false }
        } label: {
            HStack(spacing: 4) {
                Text("nick: \(nick)").font(DS.mono(11))
                Image(systemName: copied ? "checkmark" : "doc.on.doc").font(DS.ui(11))
            }.foregroundStyle(DS.muted)
        }
    }
}

/// Relative status line for a note (web noteStatus): created/edited,
/// reviewed/opened counts, due/overdue, embedding + title-source badges.
struct NoteStatusLine: View {
    let note: Note
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if let c = note.createdAt { Text("Created \(c, style: .relative) ago").font(DS.ui(11)) }
                if let u = note.updatedAt, u != note.createdAt { Text("· edited \(u, style: .relative) ago").font(DS.ui(11)) }
            }.foregroundStyle(DS.muted)
            HStack(spacing: 6) {
                if let rc = note.reviewCount, rc > 0 {
                    Text("reviewed \(rc)×").font(DS.ui(11))
                    if let d = note.reviewDueAt {
                        Text(d < Date() ? "· overdue" : "· due \(d, style: .relative)").font(DS.ui(11))
                            .foregroundStyle(d < Date() ? DS.danger : DS.muted)
                    }
                } else { Text("never reviewed").font(DS.ui(11)) }
                if let oc = note.openCount, oc > 0 { Text("· opened \(oc)×").font(DS.ui(11)) }
                else { Text("· never opened").font(DS.ui(11)) }
                if note.embeddingStale == true || note.embeddingHash == nil {
                    Text("· ● not yet embedded").font(DS.ui(11)).foregroundStyle(DS.accent)
                }
                if let ts = note.titleSource, !ts.isEmpty {
                    Text("· title: \(ts)").font(DS.ui(11))
                }
            }.foregroundStyle(DS.muted)
        }
    }
}

/// One selectable thing, by name — never by raw ID in the UI.
struct PickOption: Identifiable, Equatable {
    var id: String
    var name: String
    /// Secondary label, e.g. an author's years (web `yearsLabel`).
    var subtitle: String? = nil
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
    var excludeNames: Set<String> = []

    @State private var query = ""
    @State private var matches: [PickOption] = []
    @State private var highlighted = 0
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(placeholder, text: $query)
                .font(DS.ui(14))
                .autocorrectionDisabled()
                .onChange(of: query) { scheduleSearch() }
            if !filtered.isEmpty || canCreate {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(filtered.enumerated()), id: \.element.id) { idx, option in
                        Button {
                            onPick(option)
                            query = ""; matches = []
                        } label: {
                            HStack {
                                Text(option.name)
                                    .font(DS.ui(14, weight: idx == highlighted ? .semibold : .regular))
                                if let sub = option.subtitle {
                                    Text(sub).font(DS.ui(11)).foregroundStyle(DS.muted)
                                }
                            }
                                .foregroundStyle(DS.ink)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 6)
                                .background(idx == highlighted ? DS.hover : Color.clear)
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
    private var filtered: [PickOption] {
        matches.filter { !excludeIds.contains($0.id) && !excludeNames.contains($0.name.lowercased()) }
    }
    private var canCreate: Bool {
        onCreate != nil && trimmed.count >= 1 &&
            !filtered.contains { $0.name.lowercased() == trimmed.lowercased() }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let q = trimmed
        guard q.count >= 3 else { matches = []; return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            let results = await load(q)
            if Task.isCancelled { return }
            await MainActor.run { matches = results; highlighted = 0 }
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
                excludeIds: Set(selected.map(\.id)),
                excludeNames: Set(selected.map { $0.name.lowercased() })
            )
        }
    }
}

/// Note body text: markdown rendered inline (bold/italic/links/code),
/// falling back to plain text when parsing fails. Serif, web parity.
struct NoteText: View {
    let text: String
    var size: CGFloat = 15
    var body: some View {
        if let attributed = try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            Text(attributed).font(DS.serif(size))
        } else {
            Text(text).font(DS.serif(size))
        }
    }
}
