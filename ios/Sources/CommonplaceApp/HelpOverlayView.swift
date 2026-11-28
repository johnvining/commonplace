import SwiftUI

/// Keyboard shortcuts help (? / Ctrl+/), matching the web's Help overlay:
/// a dim backdrop and a centred card listing the Mac shortcut set.
/// Esc or a backdrop click closes it.
struct HelpOverlayView: View {
    @EnvironmentObject var state: AppState

    private let sections: [(title: String, rows: [(key: String, action: String)])] = [
        ("Global", [
            ("/ or Ctrl+O", "Search (quick bar)"),
            ("⌘K", "Quick search"),
            ("? or Ctrl+/", "Toggle this help"),
            ("h", "Home (Notes)"),
            ("c", "Create a note"),
            ("d", "Day / night / system"),
            ("⌘. or Ctrl+[", "Same as Escape"),
            ("⌘0 … ⌘9", "Time, Notes, Piles, Works, Authors, Ideas, Search, Review, Starred, Notes to file"),
            ("Ctrl+Shift+1 … 4", "Full / Slim / Grid / Tile view"),
            ("⌘N", "New note"),
            ("⌘⇧T", "Stop timer (while one runs)"),
        ]),
        ("Entity Page", [
            ("Ctrl+E", "Edit details"), ("Ctrl+A", "Save changes"),
            ("Ctrl+S", "Star / unstar"), ("Ctrl+N", "Create new note"),
            ("Ctrl+P", "Edit piles"), ("Ctrl+T", "Edit ideas (work)"),
            ("v", "View notes / all"), ("f", "Narrow (filter)"),
            ("r / i", "Read / import (work)"), ("Ctrl+U", "Upload images (work)"),
            ("b", "Back to author"), ("#", "Delete (asks first)"),
            ("Escape", "Exit edit mode"),
        ]),
        ("Selecting Notes", [
            ("x", "Select focused note"), ("*", "Select all / none"),
            ("#", "Delete selected"),
            ("Ctrl+T / w / @ / Ctrl+P", "Add idea / work / author / pile"),
            ("Ctrl+R / Ctrl+S", "OCR / suggest titles"),
            ("y", "Copy as list"), ("[ / ]", "Previous / next page"),
        ]),
        ("Note List (Full View)", [
            ("j / k", "Next / previous note"), ("Enter", "Open note"),
            ("Escape", "Deselect"), ("e", "Edit note"),
            ("o", "Open selected note"), ("Ctrl+E", "Edit note"),
            ("Ctrl+T", "Edit tags/ideas"), ("Ctrl+P", "Edit piles"),
        ]),
        ("Flip", [
            ("1 / 2 / 3", "See again fast / medium / slow"),
            ("n", "Next card"), ("p", "Previous card"),
            ("Enter", "Deal again (deck done)"),
        ]),
        ("Note Editing", [
            ("Ctrl+A", "Save changes"), ("Ctrl+F", "Format text"),
            ("Ctrl+S", "Suggest title (AI)"), ("Ctrl+R", "Run OCR"),
            ("Ctrl+U", "Upload images"), ("Ctrl+M", "Fewer / all fields"),
            ("Ctrl+I", "Image beside text"),
            ("← / Ctrl+J", "Previous image"), ("→ / Ctrl+K", "Next image"),
            ("y", "Copy nick"), ("m", "Show more"),
            ("z", "Zoom open image"), ("#", "Delete note"),
            ("Ctrl+L", "Add link"), ("Escape", "Exit edit mode"),
        ]),
    ]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.opacity(0.7)
                    .ignoresSafeArea()
                    .onTapGesture { state.helpOpen = false }
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text("Keyboard Shortcuts")
                                .font(DS.ui(17, weight: .semibold)).foregroundStyle(DS.ink)
                            Spacer()
                            Button { state.helpOpen = false } label: {
                                Text("×").font(DS.ui(18)).foregroundStyle(DS.muted)
                            }.buttonStyle(.plain)
                        }
                        ForEach(sections, id: \.title) { section in
                            VStack(alignment: .leading, spacing: 6) {
                                DSLabel(text: section.title)
                                ForEach(section.rows, id: \.key) { row in
                                    HStack(spacing: 12) {
                                        Text(row.key)
                                            .font(DS.mono(12))
                                            .frame(minWidth: 150, alignment: .leading)
                                            .foregroundStyle(DS.ink)
                                        Text(row.action)
                                            .font(DS.ui(12.5)).foregroundStyle(DS.muted)
                                        Spacer()
                                    }
                                }
                            }
                        }
                    }
                    .padding(24)
                }
                .frame(width: min(600, geo.size.width * 0.9), height: min(640, geo.size.height * 0.85))
                .background(DS.surface)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(DS.hairline, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .shadow(color: .black.opacity(0.3), radius: 20, y: 4)
            }
        }
        .onKeyPress(.escape) { state.helpOpen = false; return .handled }
    }
}
