import SwiftUI
import CommonplaceKit

/// Starred items of every type, including time subjects
/// (mirrors the web sidebar stars + pins sync).
struct PinsView: View {
    @EnvironmentObject var state: AppState
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            let time = state.pins.filter { $0.type == "time" }
            let other = state.pins.filter { $0.type != "time" }
            if !time.isEmpty {
                Section("Time subjects") {
                    ForEach(time, id: \.pinKey) { p in
                        HStack {
                            Text(p.label ?? p.id)
                            Spacer()
                            Button("Unstar") { unpin(p) }
                        }
                    }
                }
            }
            Section("Starred") {
                ForEach(other, id: \.pinKey) { p in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(p.label ?? p.id).lineLimit(1)
                            Text(p.type).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Unstar") { unpin(p) }
                    }
                }
            }
        }
        .navigationTitle("Starred")
        .task { await state.refreshPins() }
    }

    private func unpin(_ p: PinItem) {
        state.queueUnpin(type: p.type, id: p.id)
        if let err = state.lastPinError { self.error = err }
    }
}

private extension PinItem {
    var pinKey: String { "\(type):\(id)" }
}
