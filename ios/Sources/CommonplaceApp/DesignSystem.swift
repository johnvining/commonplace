import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Design tokens ported from the web's minimal layer (site/_minimal.scss):
/// one sans for UI, a reading serif for note text, hairlines instead of
/// boxes, one blue accent, purple for piles.
enum DS {
    static func dynamic(light: (Double, Double, Double), dark: (Double, Double, Double)) -> Color {
        #if os(iOS)
        return Color(UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: 1)
        })
        #elseif os(macOS)
        // AppKit dynamic provider, so tokens flip with the system
        // appearance (freezing these to the light values made dark
        // mode render dark-ink text on dark backgrounds).
        return Color(NSColor(name: nil) { appearance in
            let c = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
            return NSColor(red: c.0, green: c.1, blue: c.2, alpha: 1)
        })
        #else
        return Color(red: light.0, green: light.1, blue: light.2)
        #endif
    }

    static let ink = dynamic(light: (0.106, 0.106, 0.102), dark: (0.894, 0.894, 0.878))
    static let muted = dynamic(light: (0.431, 0.431, 0.420), dark: (0.62, 0.62, 0.60))
    static let faint = dynamic(light: (0.639, 0.639, 0.624), dark: (0.45, 0.45, 0.44))
    static let hairline = dynamic(light: (0.906, 0.906, 0.890), dark: (0.22, 0.22, 0.21))
    static let surface = dynamic(light: (1, 1, 1), dark: (0.09, 0.10, 0.12))
    static let hover = dynamic(light: (0.949, 0.949, 0.937), dark: (0.14, 0.15, 0.17))
    static let accent = dynamic(light: (0.145, 0.341, 0.788), dark: (0.45, 0.62, 1.0))
    static let accentSoft = dynamic(light: (0.933, 0.953, 0.992), dark: (0.13, 0.20, 0.35))
    static let pile = dynamic(light: (0.482, 0.247, 0.639), dark: (0.75, 0.55, 0.90))
    static let pileSoft = dynamic(light: (0.961, 0.933, 0.976), dark: (0.25, 0.16, 0.32))
    static let danger = dynamic(light: (0.72, 0.16, 0.12), dark: (1.0, 0.55, 0.48))

    static func ui(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
    static func serif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
    static func mono(_ size: CGFloat) -> Font {
        .system(size: size, design: .monospaced)
    }
}

/// The standard content padding: every list/content row uses these
/// insets so pages line up (16pt sides, 6pt vertical).
extension EdgeInsets {
    static let standardRow = EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16)
    static let standardRowWide = EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
}

/// Small uppercase section label, like the web's form labels.
struct DSLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(DS.ui(11, weight: .semibold))
            .tracking(0.6)
            .foregroundStyle(DS.faint)
    }
}

/// Hairline separator row container: content with a bottom hairline.
struct HairlineRow<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
            Rectangle().fill(DS.hairline).frame(height: 1)
        }
    }
}

/// Quiet bordered button in the web style. Plain style is load-bearing:
/// without it macOS draws its own grey capsule inside the border.
struct DSButton: View {
    let title: String
    var selected = false
    var action: () -> Void
    var body: some View {
        Button(title, action: action)
            .buttonStyle(.plain)
            .font(DS.ui(13, weight: .medium))
            .padding(.horizontal, 10)
            .frame(minHeight: 28)
            .background(selected ? DS.hover : Color.clear)
            .foregroundStyle(DS.ink)
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(DS.hairline, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 5))
    }
}

/// Loading / empty / error-with-retry. Views must use this instead of
/// silently swallowing failures.
struct LoadStateView: View {
    enum State { case loading, empty(String), error(String) }
    let state: State
    var retry: (() -> Void)? = nil
    var body: some View {
        switch state {
        case .loading:
            HStack { ProgressView(); Text("Loading…").font(DS.ui(13)).foregroundStyle(DS.muted) }
        case .empty(let message):
            Text(message).font(DS.ui(13)).foregroundStyle(DS.muted)
        case .error(let message):
            HStack {
                Text(message).font(DS.ui(13)).foregroundStyle(DS.danger)
                if let retry { Button("Retry", action: retry).font(DS.ui(13)) }
            }
        }
    }
}

/// Web edit-input treatment: hairline border, 3pt radius, quiet padding.
extension View {
    func dsInput() -> some View {
        self
            .textFieldStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(DS.surface)
            .overlay(RoundedRectangle(cornerRadius: 3).stroke(DS.hairline, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 3))
    }
}

/// Icon-only action button (web .action-button): 26pt, hairline
/// border, label carried by help/accessibility instead of text.
struct DSIconButton: View {
    let systemImage: String
    var selected = false
    let label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(DS.ui(12, weight: .medium))
                .frame(width: 26, height: 26)
        }
        .buttonStyle(.plain)
        .background(selected ? DS.hover : Color.clear)
        .foregroundStyle(DS.ink)
        .overlay(RoundedRectangle(cornerRadius: 5).stroke(DS.hairline, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .help(label)
        .accessibilityLabel(label)
    }
}
