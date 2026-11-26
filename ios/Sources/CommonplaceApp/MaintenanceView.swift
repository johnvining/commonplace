import SwiftUI
import CommonplaceKit

/// Maintenance tasks (mirrors /maintenance): dry run first, real run
/// confirms, job output polls until finished.
struct MaintenanceView: View {
    @EnvironmentObject var state: AppState
    @State private var tasks: [MaintenanceItem] = []
    @State private var jobs: [String: MaintenanceJob] = [:]
    @State private var confirming: String?
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(DS.danger) }
            ForEach(tasks, id: \.stableId) { task in
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(task.title ?? task.id ?? "").font(DS.ui(14, weight: .medium))
                        Text(task.pending == true ? "Pending" : "Done")
                            .font(DS.ui(11)).foregroundStyle(task.pending == true ? DS.accent : DS.muted)
                        if let d = task.description {
                            Text(d).font(DS.ui(12)).foregroundStyle(DS.muted)
                        }
                    }
                    if confirming == task.id {
                        HStack {
                            Button("Confirm run") { run(task, dry: false) }
                            Button("Cancel") { confirming = nil }
                        }
                    } else {
                        HStack {
                            Button("Dry run") { run(task, dry: true) }
                            Button("Run") { confirming = task.id }
                        }
                    }
                    if let job = jobs[task.id ?? ""] {
                        Text((job.output ?? []).joined(separator: "\n"))
                            .font(DS.mono(11))
                        Text(job.status ?? "").font(DS.ui(11)).foregroundStyle(DS.muted)
                    }
                }
            }
        }
        .navigationTitle("Maintenance")
        .task { await load() }
    }

    private func load() async {
        do { tasks = try await state.client.maintenanceList() }
        catch { self.error = "Load failed — retry." }
    }

    private func run(_ task: MaintenanceItem, dry: Bool) {
        guard let id = task.id else { return }
        confirming = nil
        Task {
            do {
                let ref = try await state.client.runMaintenance(id: id, dryRun: dry)
                if let jobId = ref.jobId { poll(taskId: id, jobId: jobId) }
            } catch { self.error = "Could not start — retry." }
        }
    }

    private func poll(taskId: String, jobId: String) {
        Task {
            for _ in 0..<120 {
                if let job = try? await state.client.maintenanceJob(id: jobId) {
                    await MainActor.run { jobs[taskId] = job }
                    if job.status != "running" { break }
                }
                try? await Task.sleep(nanoseconds: 1_500_000_000)
            }
            await load()
        }
    }
}

private extension MaintenanceItem {
    var stableId: String { id ?? title ?? "" }
}

/// Paste-to-import for time entries (CSV) and notes (CSV/Instapaper),
/// with the server's per-row report shown back.
struct ImportView: View {
    @EnvironmentObject var state: AppState
    @State private var kind = "time"
    @State private var text = ""
    @State private var report: String?
    @State private var busy = false

    var body: some View {
        Form {
            Picker("Import", selection: $kind) {
                Text("Time CSV").tag("time")
                Text("Notes CSV").tag("notes")
                Text("Instapaper").tag("instapaper")
                Text("URLs").tag("urls")
            }.pickerStyle(.segmented)
            if kind == "urls" {
                Text("One URL per line. Each creates a note with Title and URL set, filed under “Status: URL to Review”.")
                    .font(DS.ui(11)).foregroundStyle(DS.muted)
            }
            Section(kind == "time" ? "date,kind,minutes,title,pile" : "Paste the file contents") {
                TextEditor(text: $text).frame(minHeight: 160).font(DS.mono(12))
            }
            Button(busy ? "Importing…" : "Import") { run() }.disabled(busy || text.isEmpty)
            if let report {
                Section("Result") { Text(report).font(DS.mono(11)) }
            }
        }
        .navigationTitle("Import")
    }

    private func run() {
        busy = true
        Task {
            do {
                let message: String
                switch kind {
                case "time":
                    let result = try await state.client.importTimeEntries(parseTimeCsv(text))
                    message = describeResult(result)
                case "notes":
                    message = describeResult(try await state.client.importNotesCsv(text))
                case "urls":
                    message = try await importUrls(text)
                default:
                    message = describeResult(try await state.client.importNotesInstapaper(text))
                }
                await MainActor.run { report = message; busy = false }
            } catch let error as APIError {
                await MainActor.run {
                    if case .clientError(let status, _) = error, status == 413 {
                        report = "The import text is too large. Try splitting it into smaller batches."
                    } else {
                        report = "Import failed: \(describe(error))"
                    }
                    busy = false
                }
            } catch {
                await MainActor.run { report = "Import failed: \(describe(error))"; busy = false }
            }
        }
    }

    /// Client-side URL list import (web Load.tsx importUrlsAsNotes):
    /// one note per URL, filed under the "Status: URL to Review" pile.
    private func importUrls(_ list: String) async throws -> String {
        let urls = list.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        var pileId: String?
        if let found = try await state.client.autocompletePiles("Status: URL to Review").first(where: { $0.name == "Status: URL to Review" }), let id = found._id {
            pileId = id
        } else {
            pileId = try await state.client.createPile(name: "Status: URL to Review")._id
        }
        var imported = 0
        var failures: [String] = []
        for (idx, url) in urls.enumerated() {
            do {
                let note = try await state.client.createNote(title: url, work: nil)
                guard let nid = note._id else { failures.append("row \(idx + 1): no id returned"); continue }
                _ = try await state.client.updateNote(id: nid, NoteUpdate(url: url))
                if let pileId { _ = try await state.client.addPileToNote(noteId: nid, pileId: pileId) }
                imported += 1
            } catch { failures.append("row \(idx + 1): \(describe(error))") }
        }
        var s = "Imported \(imported) / \(urls.count)"
        if !failures.isEmpty { s += "\n" + failures.joined(separator: "\n") }
        return s
    }

    private func describeResult(_ r: TimeImportResult) -> String {
        var s = "Imported \(r.imported ?? 0)"
        if let f = r.failed, f > 0 {
            s += ", \(f) with problems:"
            for row in (r.rows ?? []).filter({ $0.ok == false }) {
                s += "\n  row \(row.row ?? 0): \(row.error ?? "")"
            }
        }
        return s
    }

    private func parseTimeCsv(_ csv: String) -> [TimeEntryBody] {
        let lines = csv.split(whereSeparator: \.isNewline).map(String.init)
        guard let header = lines.first else { return [] }
        let cols = header.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
        func idx(_ name: String) -> Int? { cols.firstIndex(of: name) }
        return lines.dropFirst().compactMap { line in
            let cells = splitCsvLine(line)
            func cell(_ name: String) -> String {
                guard let i = idx(name), i < cells.count else { return "" }
                return cells[i].trimmingCharacters(in: .whitespaces)
            }
            let pile = cell("pile")
            return TimeEntryBody(
                title: cell("title").isEmpty ? nil : cell("title"),
                pile: pile.isEmpty ? nil : pile,
                kind: cell("kind"), minutes: Int(cell("minutes")), date: cell("date"))
        }
    }

    private func splitCsvLine(_ line: String) -> [String] {
        var out: [String] = []
        var field = ""
        var quoted = false
        let chars = Array(line)
        var i = 0
        while i < chars.count {
            let c = chars[i]
            if quoted {
                if c == "\"" {
                    if i + 1 < chars.count, chars[i + 1] == "\"" { field.append("\""); i += 1 }
                    else { quoted = false }
                } else { field.append(c) }
            } else if c == "\"" { quoted = true }
            else if c == "," { out.append(field); field = "" }
            else { field.append(c) }
            i += 1
        }
        out.append(field)
        return out
    }
}
