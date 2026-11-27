import SwiftUI
import CommonplaceKit
import ImageIO
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Tap-to-copy nick with a 2s check (web ClickToCopyNick, tap-only on iOS).
struct CopyNickButton: View {
    let nick: String
    @State private var copied = false
    var body: some View {
        Button {
            #if os(iOS)
            UIPasteboard.general.string = nick
            #elseif os(macOS)
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(nick, forType: .string)
            #endif
            copied = true
            Task { try? await Task.sleep(nanoseconds: 2_000_000_000); copied = false }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: copied ? "checkmark" : "doc.on.doc").font(DS.ui(11))
                Text(nick).font(DS.mono(11))
            }.foregroundStyle(DS.faint)
        }
    }
}

/// Relative status line for a note (web noteStatus): created/edited,
/// reviewed/opened counts, due/overdue, embedding + title-source badges.
struct NoteStatusLine: View {
    let note: Note
    var body: some View {
        FlowLayout(spacing: 4) {
            if let c = note.createdAt { Text("Created \(c, style: .relative) ago").font(DS.ui(11)).foregroundStyle(DS.muted) }
            if let u = note.updatedAt, u != note.createdAt { Text("· edited \(u, style: .relative) ago").font(DS.ui(11)).foregroundStyle(DS.muted) }
            if let reviewedAt = note.reviewedAt {
                Text("· reviewed \(reviewedAt, style: .relative) ago").font(DS.ui(11)).foregroundStyle(DS.muted)
            } else if (note.reviewCount ?? 0) > 0 {
                Text("· reviewed \(note.reviewCount ?? 0)×").font(DS.ui(11)).foregroundStyle(DS.muted)
            } else {
                Text("· never reviewed").font(DS.ui(11)).foregroundStyle(DS.muted)
            }
            if let d = note.reviewDueAt {
                Text(d < Date() ? "· overdue" : "· due \(d, style: .relative)")
                    .font(DS.ui(11))
                    .foregroundStyle(d < Date() ? DS.danger : DS.muted)
            }
            if let oc = note.openCount, oc > 0 { Text("· opened \(oc)×").font(DS.ui(11)).foregroundStyle(DS.muted) }
            else { Text("· never opened").font(DS.ui(11)).foregroundStyle(DS.muted) }
            if note.embeddingStale == true || note.embeddingHash == nil {
                Circle().fill(DS.faint).frame(width: 6, height: 6)
                    .accessibilityLabel("Not yet embedded")
            }
        }
    }}

/// Standard entity-page header (web entity-page-header-left): name at
/// title size, quiet byline, and the nick with tap-to-copy under it.
/// The page's standard buttons sit top-right beside this block.
struct EntityTitleBlock: View {
    let name: String
    var italicName: Bool = false
    var byline: String? = nil
    var nick: String? = nil
    var splitPilePrefix: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if splitPilePrefix, let parts = Self.pileParts(name) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(parts.0.uppercased())
                        .font(DS.ui(11, weight: .semibold)).tracking(0.6)
                        .foregroundStyle(DS.faint)
                    Text(parts.1)
                        .font(DS.ui(20, weight: .semibold))
                        .foregroundStyle(DS.ink)
                }
            } else {
                Text(name)
                    .font(DS.ui(20, weight: .semibold))
                    .italic(italicName)
                    .foregroundStyle(DS.ink)
            }
            if let byline, !byline.isEmpty {
                Text(byline).font(DS.ui(12)).foregroundStyle(DS.muted)
            }
            if let nick, !nick.isEmpty {
                CopyNickButton(nick: nick)
            }
        }
    }

    static func pileParts(_ name: String) -> (String, String)? {
        guard let colon = name.firstIndex(of: ":") else { return nil }
        let prefix = name[..<colon].trimmingCharacters(in: .whitespaces)
        let value = name[name.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        guard !prefix.isEmpty, prefix.count <= 20, !prefix.contains(" "), !value.isEmpty else { return nil }
        return (prefix, value)
    }
}

/// The standard entity-page header used by Pile, Work, Author and
/// Idea pages: title block (name, byline, nick+copy) on the left, the
/// page's standard buttons — Star, Edit, Web, Delete, plus any extras —
/// top-right. Every entity page shares this so formatting, links and
/// nick handling can never drift apart.
struct EntityPageHeader<Actions: View>: View {
    let name: String
    var italicName: Bool = false
    var byline: String? = nil
    var nick: String? = nil
    var splitPilePrefix: Bool = false
    @ViewBuilder var actions: Actions

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            EntityTitleBlock(name: name, italicName: italicName, byline: byline, nick: nick, splitPilePrefix: splitPilePrefix)
            Spacer()
            FlowLayout(spacing: 6) {
                actions
            }
        }
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) {
            Rectangle().fill(DS.hairline).frame(height: 1)
        }
    }
}

/// Quiet full-page loading state, so detail pages don't flash an
/// empty white list before their content lands.
struct LoadingBlock: View {
    var body: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Loading…").font(DS.ui(12)).foregroundStyle(DS.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 220)
        .listRowSeparator(.hidden)
    }
}

/// Opens this exact page on the website (note/…, pile/…, idea/…,
/// work/…, auth/…), in the same quiet button style as DSButton.
struct OpenInWebButton: View {
    @EnvironmentObject var state: AppState
    let path: String

    var body: some View {
        if let url = state.webURL(path: path) {
            Link(destination: url) {
                HStack(spacing: 4) {
                    Text("Web")
                    Image(systemName: "arrow.up.forward.square").font(DS.ui(11))
                }
                .font(DS.ui(13, weight: .medium))
                .padding(.horizontal, 10)
                .frame(minHeight: 28)
                .foregroundStyle(DS.ink)
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(DS.hairline, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 5))
            }
            .buttonStyle(.plain)
            .help("Open this page on the website")
        }
    }
}

/// The label half of DSButton for NavigationLinks (Narrow, Read, …)
/// so link-buttons look identical to action buttons.
struct DSButtonLabel: View {
    let title: String

    var body: some View {
        Text(title)
            .font(DS.ui(13))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .foregroundStyle(DS.ink)
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(DS.hairline, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

/// One web-format tag: square, kind-coloured text on its kind tint.
struct NoteTag: View {
    let name: String
    let color: Color
    let tint: Color

    var body: some View {
        Text(name)
            .font(DS.ui(11))
            .foregroundStyle(color)
            .lineLimit(1)
            .padding(.horizontal, 5)
            .frame(height: 19)
            .background(tint)
            .clipShape(RoundedRectangle(cornerRadius: 2))
    }
}

/// All idea/pile tags for a note on one clipped line (web clips the
/// row instead of counting "+N").
struct NoteTagRow: View {
    let note: Note

    var body: some View {
        HStack(spacing: 4) {
            ForEach(note.ideas ?? [], id: \.id) { idea in
                NoteTag(name: idea.name ?? "", color: DS.accent, tint: DS.accentSoft)
            }
            ForEach(note.piles ?? [], id: \.id) { pile in
                NoteTag(name: pile.name ?? "", color: DS.pile, tint: DS.pileSoft)
            }
        }
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipped()
    }
}

/// One row in an entity list (works/authors/ideas/piles): serif name,
/// quiet count line, no system separator — the site's lists separate
/// with whitespace, not lines under every row.
struct EntityListRow: View {
    let name: String
    var meta: [String] = []
    var italicName: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(name)
                .font(DS.serif(15.5, weight: .semibold))
                .italic(italicName)
                .foregroundStyle(DS.ink)
                .lineLimit(1)
            if !meta.isEmpty {
                Text(meta.joined(separator: " · "))
                    .font(DS.ui(11))
                    .foregroundStyle(DS.muted)
            }
        }
        .padding(.vertical, 3)
    }
}

extension Note {
    private func nonEmpty(_ s: String?) -> String? {
        let t = (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    /// LIST DISPLAY ONLY: what to call the note in a row or card —
    /// title, else its first content (newlines collapsed, so a
    /// three-line text makes a one-line title). The note page itself
    /// never uses this; it shows the real title or "(untitled)".
    var displayTitle: String {
        if let t = nonEmpty(title) { return t }
        let collapsed = [text, take, url]
            .compactMap { nonEmpty($0) }
            .first?
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
        return collapsed ?? "No Text"
    }

    /// LIST DISPLAY ONLY: preview cascade text → take → URL →
    /// "No Text", so a row always has something to show.
    var displayText: String {
        nonEmpty(text) ?? nonEmpty(take) ?? nonEmpty(url) ?? "No Text"
    }

    /// Authors for display: the note's own, else its work's (web
    /// authorsWithWorkFallback).
    var displayAuthors: [PopulatedRef] {
        if let authors, !authors.isEmpty { return authors }
        return work?.authors ?? []
    }
}

/// Parsed flow paragraphs by content key, so scrolling and view-mode
/// switches never re-parse markdown for the same note text.
final class FlowTextCache {
    static let shared = NSCache<NSString, AnyObject>()
}

final class FlowTextBox {
    let value: AttributedString
    init(_ value: AttributedString) { self.value = value }
}

/// The web's flowing note paragraph at one size: authors, work in
/// italics, bold title, then the text — all the same serif size, so
/// rows never mix 12pt labels with 15pt titles.
struct NoteFlowText: View {
    let note: Note
    var size: CGFloat = 14.5
    var lines: Int? = nil

    var body: some View {
        Text(flow)
            .font(DS.serif(size))
            .foregroundStyle(DS.ink)
            .lineSpacing(3)
            .lineLimit(lines)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var flow: AttributedString {
        var md = ""
        var cite: [String] = []
        if !note.displayAuthors.isEmpty {
            cite.append(note.displayAuthors.compactMap(\.name).joined(separator: ", "))
        }
        if let w = note.work?.name, !w.isEmpty {
            cite.append("*\(w)*")
        }
        if !cite.isEmpty { md += cite.joined(separator: ", ") + ": " }
        let hasTitle = !(note.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        if hasTitle {
            md += "**\(note.displayTitle).** "
        }
        md += note.displayText
        let key = md as NSString
        if let hit = FlowTextCache.shared.object(forKey: key) as? FlowTextBox {
            return hit.value
        }
        let parsed = (try? AttributedString(markdown: md, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(md)
        FlowTextCache.shared.setObject(FlowTextBox(parsed), forKey: key)
        return parsed
    }
}

/// One note image rendered from API data on both platforms.
struct NoteImageView: View {
    let data: Data?
    var contentMode: ContentMode = .fill

    var body: some View {
        #if os(macOS)
        if let data, let img = NSImage(data: data) {
            Image(nsImage: img).resizable().aspectRatio(contentMode: contentMode)
        } else {
            placeholder
        }
        #else
        if let data, let img = UIImage(data: data) {
            Image(uiImage: img).resizable().aspectRatio(contentMode: contentMode)
        } else {
            placeholder
        }
        #endif
    }

    private var placeholder: some View {
        Rectangle().fill(DS.hover)
            .overlay(Image(systemName: "photo").foregroundStyle(DS.faint))
    }
}

/// Decode image data down to a thumbnail-sized bitmap so list/grid
/// scrolling never decodes full-resolution photos.
func downsampledImageData(_ data: Data, maxPixelSize: Int) -> Data? {
    let options: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
    ]
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    else { return nil }
    #if os(macOS)
    let rep = NSBitmapImageRep(cgImage: cg)
    return rep.representation(using: .png, properties: [:])
    #else
    return UIImage(cgImage: cg).pngData()
    #endif
}

/// Downsampled thumbnails by note+index, so switching view modes or
/// scrolling rows back on screen never refetches or re-decodes.
final class ThumbCache {
    static let shared: NSCache<NSString, NSData> = {
        let cache = NSCache<NSString, NSData>()
        cache.countLimit = 300
        return cache
    }()
}

extension ThumbCache {
    static func get(_ key: String) -> Data? {
        shared.object(forKey: key as NSString) as Data?
    }
    static func set(_ key: String, _ data: Data) {
        shared.setObject(data as NSData, forKey: key as NSString)
    }
}

/// Thumbnail that fetches one of a note's images (1-based, API order).
struct NoteImageThumb: View {
    @EnvironmentObject var state: AppState
    let noteId: String
    let index: Int

    @State private var data: Data?

    private var cacheKey: String { "\(noteId)-\(index)" }

    var body: some View {
        NoteImageView(data: data)
            .task(id: cacheKey) {
                if let cached = ThumbCache.get(cacheKey) {
                    data = cached
                    return
                }
                guard let raw = try? await state.client.noteImageData(noteId: noteId, index: index)
                else { return }
                let thumb = downsampledImageData(raw, maxPixelSize: 512) ?? raw
                ThumbCache.set(cacheKey, thumb)
                data = thumb
            }
    }
}

/// Kind + subject line for time displays: the Reading/Writing kind is
/// a small-caps sans label (never serif); what is being read/written —
/// the subject — is serif.
struct KindSubjectLine: View {
    let kind: String
    let subject: String

    var body: some View {
        HStack(spacing: 6) {
            Text(kind.uppercased())
                .font(DS.ui(10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(DS.muted)
            Text(subject)
                .font(DS.serif(13))
                .foregroundStyle(DS.ink)
                .lineLimit(1)
        }
    }
}

/// Unified view selector, web ViewSelector parity: one joined icon
/// group (Full · Slim · Grid · Tile, in web order), icon-only with
/// help tooltips and the web's Ctrl+Shift+1…4 shortcuts. Shared by
/// every note list so the control looks and behaves the same
/// everywhere; `mode` keeps the persisted string values
/// ("full"/"slim"/"grid"/"tile").
struct UnifiedViewSelector: View {
    @Binding var mode: String

    private let views: [(mode: String, icon: String, label: String, key: Character)] = [
        ("full", "doc.text", "Full view", "1"),
        ("slim", "list.bullet", "Slim view", "2"),
        ("grid", "square.grid.2x2", "Grid view", "3"),
        ("tile", "square.grid.3x3", "Tile view", "4"),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(views.enumerated()), id: \.element.mode) { idx, v in
                Button {
                    mode = v.mode
                } label: {
                    Image(systemName: v.icon)
                        .font(DS.ui(13, weight: mode == v.mode ? .semibold : .regular))
                        .foregroundStyle(mode == v.mode ? DS.ink : DS.muted)
                        .frame(width: 34, height: 26)
                        .background(mode == v.mode ? DS.hover : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .help("\(v.label) (Ctrl+Shift+\(v.key))")
                .keyboardShortcut(KeyEquivalent(v.key), modifiers: [.control, .shift])
                if idx < views.count - 1 {
                    Rectangle().fill(DS.hairline).frame(width: 1, height: 18)
                }
            }
        }
        // No border of its own: in a toolbar the system already draws
        // one capsule around the group — a second outline fought it.
        .padding(.horizontal, 2)
    }
}

/// Left-to-right wrapping row (tags, chips): each subview takes its
/// natural width and wraps to the next line when the row fills.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
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
                FlowLayout(spacing: 4) {
                    ForEach(selected) { option in
                        HStack(spacing: 4) {
                            Text(option.name)
                                .font(DS.ui(12))
                                .foregroundStyle(tint == DS.pileSoft ? DS.pile : DS.accent)
                                .lineLimit(1)
                            Button("×") { onRemove(option) }
                                .font(DS.ui(12, weight: .bold))
                                .foregroundStyle(DS.muted)
                                .buttonStyle(.borderless)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(tint)
                        .clipShape(RoundedRectangle(cornerRadius: 2))
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
        Text(parsed).font(DS.serif(size))
    }

    private var parsed: AttributedString {
        let key = text as NSString
        if let hit = FlowTextCache.shared.object(forKey: key) as? FlowTextBox {
            return hit.value
        }
        let value = (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
        FlowTextCache.shared.setObject(FlowTextBox(value), forKey: key)
        return value
    }
}
