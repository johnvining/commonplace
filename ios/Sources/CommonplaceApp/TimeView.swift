import SwiftUI
import CommonplaceKit

/// Timer-first time log (mirrors site/Time.tsx). Top: subject picker
/// (starred then recent), Reading/Writing toggle, Start/Stop + elapsed.
/// Below: day nav, daily + weekly summaries with cross-checks, day entries
/// with star/edit/delete, and a manual entry form.
struct TimeView: View {
    @EnvironmentObject var state: AppState
    @State private var subjects: [RecentSubject] = []
    @State private var selection = ""
    @State private var kind = "reading"
    @State private var day = dayString(Date())
    @State private var entries: [TimeEntry] = []
    @State private var summary: TimeSummary?
    @State private var error: String?
    @State private var showManual = false

    var body: some View {
        NavigationStack {
            List {
                Section("Timer") {
                    Picker("Subject", selection: $selection) {
                        Text("Pick something…").tag("")
                        let starred = state.pins.filter { $0.type == "time" }
                        if !starred.isEmpty {
                            Section("Starred") {
                                ForEach(starred, id: \.id) { p in
                                    Text(p.label ?? p.id).tag(p.id)
                                }
                            }
                        }
                        if !subjects.isEmpty {
                            Section("Recent") {
                                ForEach(subjects, id: \.key) { s in
                                    Text(subjectLabel(s)).tag(s.key)
                                }
                            }
                        }
                    }
                    Picker("Kind", selection: $kind) {
                        Text("Reading").tag("reading")
                        Text("Writing").tag("writing")
                    }
                    .pickerStyle(.segmented)
                    if state.timerIsRunning, let at = state.timerStartedAt {
                        TimelineView(.periodic(from: Date(), by: 1.0)) { ctx in
                            Text(formatElapsed(ctx.date.timeIntervalSince(at) * 1000))
                                .font(.title.monospacedDigit())
                        }
                        Button("Stop") { stopTimer() }
                            .disabled(selection.isEmpty && state.timerSubjectKey == nil)
                    } else {
                        Button("Start") {
                            state.startTimer(key: selection, kind: kind)
                        }
                        .disabled(selection.isEmpty)
                    }
                    if let error { Text(error).foregroundStyle(.red) }
                }
                Section("Day") {
                    HStack {
                        Button("‹ Prev") { shift(-1) }
                        DatePicker("", selection: dayBinding, displayedComponents: .date)
                            .labelsHidden()
                        Button("Next ›") { shift(1) }
                        Button("Today") { day = dayString(Date()); reload() }
                    }
                }
                if let d = summary?.daily {
                    Section("Daily — \(d.date ?? day)") {
                        Text("Total \(formatMinutes(d.totalMinutes ?? 0)) · R \(formatMinutes(d.readingMinutes ?? 0)) · W \(formatMinutes(d.writingMinutes ?? 0)) · \(d.entryCount ?? 0) entries")
                        Text(crossCheck(reading: d.readingMinutes ?? 0,
                                        writing: d.writingMinutes ?? 0,
                                        total: d.totalMinutes ?? 0))
                            .font(.caption).foregroundStyle(.secondary)
                        pileRows(d.byPile)
                        titleRows(d.byTitle)
                    }
                }
                Section("Entries") {
                    ForEach(entries, id: \.stableId) { e in
                        TimeEntryRow(entry: e, onStar: { star(e) },
                                    onSave: { reload() },
                                    onDelete: { delete(e) },
                                    onError: { self.error = $0 })
                    }
                }
                if let w = summary?.weekly {
                    Section("Week of \(w.weekStart ?? "")") {
                        Text("Total \(formatMinutes(w.totalMinutes ?? 0)) · R \(formatMinutes(w.readingMinutes ?? 0)) · W \(formatMinutes(w.writingMinutes ?? 0))")
                        Text(crossCheck(reading: w.readingMinutes ?? 0,
                                        writing: w.writingMinutes ?? 0,
                                        total: w.totalMinutes ?? 0))
                            .font(.caption).foregroundStyle(.secondary)
                        if let days = w.byDay {
                            let sum = days.reduce(0) { $0 + ($1.totalMinutes ?? 0) }
                            Text(sum == (w.totalMinutes ?? 0)
                                 ? "Cross-check OK: 7 days sum to total"
                                 : "Cross-check MISMATCH: days sum to \(formatMinutes(sum))")
                                .font(.caption).foregroundStyle(.secondary)
                            ForEach(days, id: \.date) { d in
                                Button("\(d.date ?? "") — \(formatMinutes(d.totalMinutes ?? 0))") {
                                    if let dt = d.date { day = dt; reload() }
                                }
                            }
                        }
                        pileRows(w.byPile)
                        titleRows(w.byTitle)
                    }
                }
                Section {
                    Button(showManual ? "Hide manual log" : "Log manually") {
                        showManual.toggle()
                    }
                    if showManual {
                        ManualEntryForm(defaultDay: day, onSaved: { reload() })
                    }
                }
            }
            .listStyle(.plain)
        .navigationTitle("Time")
            .task { initialLoad() }
        }
    }

    private func initialLoad() {
        Task {
            subjects = (try? await state.client.recentSubjects(limit: 20)) ?? []
            if let first = subjects.first, selection.isEmpty { selection = first.key }
        }
        reload()
    }

    private func reload() {
        Task {
            do {
                entries = try await state.client.listTimeEntries(from: day, to: day)
                summary = try await state.client.timeSummary(date: day)
            } catch {
                self.error = "Load failed — retry."
            }
        }
    }

    private var dayBinding: Binding<Date> {
        Binding(
            get: { parseDay(day) ?? Date() },
            set: { day = dayString($0); reload() }
        )
    }

    private func shift(_ delta: Int) {
        if let s = shiftDay(day, by: delta) { day = s; reload() }
    }

    private func stopTimer() {
        guard let at = state.timerStartedAt else { return }
        let key = state.timerSubjectKey ?? selection
        let logKind = state.timerKind
        var t = TimerState(subjectKey: key, kind: logKind, startedAt: at)
        guard let minutes = t.stop(at: Date()) else { return }
        Task {
            do {
                try await log(key: key, kind: logKind, minutes: minutes, date: dayString(Date()))
                await MainActor.run { state.clearTimer(); reload() }
            } catch {
                await MainActor.run { self.error = "Stop failed — retry." }
            }
        }
    }

    /// Original-case title for a subject: recents first, then the pin
    /// label, then the raw key (matching the web resolve order).
    private func displayTitle(forKey key: String) -> String? {
        if let recent = subjects.first(where: { $0.key == key }) { return recent.title }
        if let pin = state.pins.first(where: { $0.id == key }),
           let label = pin.label, !label.isEmpty { return label }
        if case .title(let slug) = TimeSubjectKey.parse(key) { return slug }
        return nil
    }

    func log(key: String, kind: String, minutes: Int, date: String) async throws {
        let recent = subjects.first(where: { $0.key == key })
        let body: TimeEntryBody
        if let sub = TimeSubjectKey.parse(key) {
            switch sub {
            case .pile(let id):
                body = TimeEntryBody(title: recent?.title, pile: id,
                                     kind: kind, minutes: minutes, date: date)
            case .title:
                body = TimeEntryBody(title: displayTitle(forKey: key) ?? key,
                                     kind: kind, minutes: minutes, date: date)
            }
        } else {
            body = TimeEntryBody(title: key, kind: kind, minutes: minutes, date: date)
        }
        _ = try await state.client.createTimeEntry(body)
    }

    private func star(_ e: TimeEntry) {
        let key = subjectKey(of: e)
        state.queuePin(type: "time", id: key, label: subjectTitle(of: e),
                       href: "/time?subject=\(key)")
    }

    private func delete(_ e: TimeEntry) {
        guard let id = e._id else { return }
        Task {
            do {
                try await state.client.deleteTimeEntry(id: id)
                await MainActor.run { reload() }
            } catch {
                await MainActor.run { self.error = "Delete failed — retry." }
            }
        }
    }

    private func subjectKey(of e: TimeEntry) -> String {
        if let pid = e.pile?.id { return TimeSubjectKey.pileKey(pileId: pid) }
        return TimeSubjectKey.titleKey(title: e.title ?? "")
    }

    private func subjectTitle(of e: TimeEntry) -> String {
        e.pile?.name ?? e.title ?? ""
    }

    private func subjectLabel(_ s: RecentSubject) -> String {
        s.pile?.name ?? s.title ?? s.key
    }

    private func crossCheck(reading: Int, writing: Int, total: Int) -> String {
        reading + writing == total
            ? "Cross-check OK: R + W = total"
            : "Cross-check MISMATCH: R(\(reading)) + W(\(writing)) ≠ total(\(total))"
    }

    private func pileRows(_ rows: [PileSubjectRow]?) -> some View {
        Group {
            if let rows {
                ForEach(rows, id: \.pile) { r in
                    Text("\(r.name ?? r.pile ?? "") — \(formatMinutes(r.minutes ?? 0)) (R \(formatMinutes(r.readingMinutes ?? 0)) W \(formatMinutes(r.writingMinutes ?? 0)))")
                        .font(.caption)
                }
            }
        }
    }

    private func titleRows(_ rows: [TitleSubjectRow]?) -> some View {
        Group {
            if let rows {
                ForEach(rows, id: \.title) { r in
                    Text("\(r.title ?? "") — \(formatMinutes(r.minutes ?? 0))")
                        .font(.caption)
                }
            }
        }
    }
}

private extension TimeEntry {
    /// Stable across renders (no fresh UUID per evaluation).
    var stableId: String {
        _id ?? ["t", title, kind,
                minutes.map(String.init), date.map(dayString),
                pile?.id].compactMap { $0 }.joined(separator: "|")
    }
}

/// One day entry with star / edit / delete (delete confirms).
/// Edit covers title, kind, minutes and day; the pile link is unchanged.
struct TimeEntryRow: View {
    @EnvironmentObject var state: AppState
    let entry: TimeEntry
    let onStar: () -> Void
    let onSave: () -> Void
    let onDelete: () -> Void
    let onError: (String) -> Void
    @State private var editing = false
    @State private var title = ""
    @State private var minutes = ""
    @State private var kind = "reading"
    @State private var date = ""
    @State private var confirming = false

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text("\(entry.kind ?? "") · \(formatMinutes(entry.minutes ?? 0))")
                Text(entry.pile?.name ?? entry.title ?? "")
                    .foregroundStyle(.secondary)
                Spacer()
                Button("★", action: onStar)
                Button("Edit") {
                    title = entry.title ?? ""
                    minutes = String(entry.minutes ?? 0)
                    kind = entry.kind ?? "reading"
                    date = entry.date.map(dayString) ?? ""
                    editing.toggle()
                }
                Button("Delete") { confirming = true }
                    .confirmationDialog("Delete entry?", isPresented: $confirming) {
                        Button("Delete", role: .destructive, action: onDelete)
                    }
            }
            if editing {
                TextField("Title", text: $title)
                HStack {
                    TextField("Minutes", text: $minutes)
                    DatePicker("Day", selection: Binding(
                        get: { parseDay(date) ?? Date() },
                        set: { date = dayString($0) }
                    ), displayedComponents: .date)
                }
                Picker("Kind", selection: $kind) {
                    Text("Reading").tag("reading")
                    Text("Writing").tag("writing")
                }.pickerStyle(.segmented)
                Button("Save") { save() }
            }
        }
    }

    private func save() {
        guard let id = entry._id, let m = Int(minutes), m >= 1 else { return }
        Task {
            do {
                _ = try await state.client.updateTimeEntry(
                    id: id, TimeEntryBody(
                        title: title.trimmingCharacters(in: .whitespaces).isEmpty ? nil : title,
                        kind: kind, minutes: m,
                        date: date.trimmingCharacters(in: .whitespaces).isEmpty ? nil : date))
                await MainActor.run { editing = false; onSave() }
            } catch {
                await MainActor.run { onError("Save failed — retry.") }
            }
        }
    }
}

/// Manual log form: title or pile id, kind toggle, minutes, date.
struct ManualEntryForm: View {
    @EnvironmentObject var state: AppState
    let defaultDay: String
    let onSaved: () -> Void
    @State private var title = ""
    @State private var pile = ""
    @State private var pileName = ""
    @State private var kind = "reading"
    @State private var minutes = ""
    @State private var date = ""
    @State private var error: String?

    var body: some View {
        VStack {
            TextField("Title", text: $title)
            if !pile.isEmpty {
                HStack {
                    Text(pileName.isEmpty ? pile : pileName)
                    Spacer()
                    Button("Clear") { pile = ""; pileName = "" }
                }
            } else {
                TypeaheadField(
                    placeholder: "Link a pile…",
                    load: { q in ((try? await state.client.autocompletePiles(q)) ?? []).compactMap { p in p._id.map { PickOption(id: $0, name: p.name ?? "") } } },
                    onPick: { opt in pile = opt.id; pileName = opt.name },
                    onCreate: { name in
                        Task {
                            if let p = try? await state.client.createPile(name: name), let id = p._id {
                                await MainActor.run { pile = id; pileName = p.name ?? name }
                            }
                        }
                    }
                )
            }
            Picker("Kind", selection: $kind) {
                Text("Reading").tag("reading")
                Text("Writing").tag("writing")
            }.pickerStyle(.segmented)
            TextField("Minutes", text: $minutes)
            DatePicker("Day", selection: Binding(
                get: { parseDay(date.isEmpty ? defaultDay : date) ?? Date() },
                set: { date = dayString($0) }
            ), displayedComponents: .date)
            Button("Save") { save() }
            if let error { Text(error).foregroundStyle(.red).font(.caption) }
        }
    }

    private func save() {
        guard let m = Int(minutes), m >= 1 else { self.error = "Minutes must be ≥ 1."; return }
        let pileId = pile.trimmingCharacters(in: .whitespaces).isEmpty ? nil : pile
        let body = TimeEntryBody(title: title.isEmpty ? nil : title,
                                 pile: pileId, kind: kind, minutes: m,
                                 date: date.isEmpty ? defaultDay : date)
        Task {
            do {
                _ = try await state.client.createTimeEntry(body)
                await MainActor.run { onSaved() }
            } catch {
                await MainActor.run { self.error = "Save failed — retry." }
            }
        }
    }
}

private extension Pile {
    var stableId: String { _id ?? ["p", name].compactMap { $0 }.joined(separator: "|") }
}
