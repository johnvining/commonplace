import SwiftUI
import CommonplaceKit

/// Timer-first time log (mirrors site/Time.tsx). Top: subject picker
/// (starred then recent), Reading/Writing toggle, Start/Stop + elapsed.
/// Below: day nav, daily + weekly summaries with cross-checks, day entries
/// with star/edit/delete, and a manual entry form.
struct TimeView: View {
    @EnvironmentObject var state: AppState
    var preselectSubject: String? = nil
    @State private var subjects: [RecentSubject] = []
    @State private var selection = ""
    @State private var kind = "writing"
    @State private var day = localDayString()
    @State private var entries: [TimeEntry] = []
    @State private var summary: TimeSummary?
    @State private var error: String?
    @State private var showManual = false
    @State private var newName = ""
    @State private var customTitles: [String: String] = [:]
    @State private var scope = "today"

    var body: some View {
        NavigationStack {
            List {
                Section {
                    // One left-to-right row like the web timer:
                    // subject, kind, elapsed/Start — nothing right-aligned.
                    HStack(spacing: 10) {
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
                        let recentUnstarred = subjects.filter { s in !starred.contains { $0.id == s.key } }
                        if !recentUnstarred.isEmpty {
                            Section("Recent") {
                                ForEach(recentUnstarred, id: \.key) { s in
                                    Text(subjectLabel(s)).tag(s.key)
                                }
                            }
                        }
                        let named = customTitles
                            .filter { kv in !subjects.contains { $0.key == kv.key } }
                            .sorted { $0.value < $1.value }
                        if !named.isEmpty {
                            Section("Named") {
                                ForEach(named, id: \.key) { kv in
                                    Text(kv.value).tag(kv.key)
                                }
                            }
                        }
                        }
                        .labelsHidden()
                        .pickerStyle(.menu)
                        .fixedSize()
                        Picker("Kind", selection: $kind) {
                            Text("Reading").tag("reading")
                            Text("Writing").tag("writing")
                        }
                        .labelsHidden()
                        .pickerStyle(.segmented)
                        .frame(width: 170)
                        if state.timerIsRunning, let at = state.timerStartedAt {
                            TimelineView(.periodic(from: Date(), by: 1.0)) { ctx in
                                Text(formatElapsed(ctx.date.timeIntervalSince(at) * 1000))
                                    .font(DS.ui(19, weight: .semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(DS.ink)
                            }
                            DSButton(title: "Stop") { stopTimer() }
                        } else {
                            DSButton(title: "Start") {
                                state.startTimer(key: selection, kind: kind,
                                             label: displayTitle(forKey: selection) ?? subjects.first(where: { $0.key == selection }).map(subjectLabel))
                            }
                            .disabled(selection.isEmpty)
                            .opacity(selection.isEmpty ? 0.5 : 1)
                        }
                        Spacer()
                    }
                    HStack(spacing: 8) {
                        TextField("Name something new…", text: $newName)
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()
                        DSButton(title: "Use name") { useNewName() }
                            .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty || state.timerIsRunning)
                            .opacity(newName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                        Spacer()
                    }
                    if let error { Text(error).font(DS.ui(12)).foregroundStyle(DS.danger) }
                }
                .listRowSeparator(.hidden)

                Section {
                    if entries.isEmpty {
                        Text("No entries this day.").font(DS.ui(13)).foregroundStyle(DS.muted)
                    }
                    ForEach(entries, id: \.stableId) { e in
                        TimeEntryRow(entry: e, onStar: { star(e) },
                                    onSave: { reload() },
                                    onDelete: { delete(e) },
                                    onError: { self.error = $0 })
                    }
                } header: {
                    HStack(spacing: 8) {
                        Text(day == localDayString() ? "Today" : day)
                            .font(DS.ui(15, weight: .semibold))
                            .foregroundStyle(DS.ink)
                            .textCase(nil)
                        Spacer()
                        DSButton(title: "‹") { shift(-1) }
                        DatePicker("", selection: dayBinding, displayedComponents: .date)
                            .labelsHidden()
                        DSButton(title: "›") { shift(1) }
                        DSButton(title: "Today", selected: day == localDayString()) { day = dayString(Date()); reload() }
                    }
                }

                if summary != nil {
                    Section {
                        Picker("Scope", selection: $scope) {
                            Text("Today").tag("today")
                            Text("This week").tag("week")
                            Text("Last 7 days").tag("last7")
                            Text("This month").tag("month")
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()

                        HStack(spacing: 10) {
                            Text(formatMinutes(analysis.total) + " total")
                                .font(DS.serif(18, weight: .semibold))
                                .foregroundStyle(DS.ink)
                            KindMinutes(kind: "reading", minutes: analysis.reading)
                            KindMinutes(kind: "writing", minutes: analysis.writing)
                            Text("\(analysis.count) \(analysis.count == 1 ? "entry" : "entries")")
                                .font(DS.ui(11)).foregroundStyle(DS.faint)
                            Spacer()
                        }

                        if scope != "today", let days = analysis.byDay {
                            DSLabel(text: "By day")
                            ForEach(days, id: \.date) { d in
                                tableRow(name: d.date ?? "", reading: d.readingMinutes ?? 0,
                                         writing: d.writingMinutes ?? 0, total: d.totalMinutes ?? 0)
                            }
                        }
                        if let rows = analysis.byPile, !rows.isEmpty {
                            DSLabel(text: "By pile")
                            ForEach(rows, id: \.pile) { r in
                                tableRow(name: r.name ?? r.pile ?? "", reading: r.readingMinutes ?? 0,
                                         writing: r.writingMinutes ?? 0, total: r.minutes ?? 0)
                            }
                        }
                        if let rows = analysis.byWork, !rows.isEmpty {
                            DSLabel(text: "By work")
                            ForEach(rows, id: \.work) { r in
                                tableRow(name: r.name ?? r.work ?? "", reading: r.readingMinutes ?? 0,
                                         writing: r.writingMinutes ?? 0, total: r.minutes ?? 0, italicName: true)
                            }
                        }
                        if let rows = analysis.byTitle, !rows.isEmpty {
                            DSLabel(text: "By title")
                            ForEach(rows, id: \.title) { r in
                                tableRow(name: r.title ?? "", reading: r.readingMinutes ?? 0,
                                         writing: r.writingMinutes ?? 0, total: r.minutes ?? 0)
                            }
                        }
                    } header: {
                        Text("Analysis")
                            .font(DS.ui(15, weight: .semibold))
                            .foregroundStyle(DS.ink)
                            .textCase(nil)
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
            .onChange(of: preselectSubject) {
                if let preselectSubject, !preselectSubject.isEmpty { selection = preselectSubject }
            }
        }
    }

    private func initialLoad() {
        if let data = UserDefaults.standard.data(forKey: "time_custom_titles"),
           let map = try? JSONDecoder().decode([String: String].self, from: data) {
            customTitles = map
        }
        if let preselectSubject, !preselectSubject.isEmpty { selection = preselectSubject }
        Task {
            do {
                subjects = try await state.client.recentSubjects(limit: 20)
                state.publishWidgetSnapshot(recents: subjects.map {
                    WidgetRecent(key: $0.key, label: subjectLabel($0), kind: $0.kind ?? "writing")
                })
                if let first = subjects.first, selection.isEmpty { selection = first.key }
            } catch { self.error = "Recent subjects failed: \(describe(error))" }
        }
        reload()
    }

    @State private var reloadTask: Task<Void, Never>?

    private func reload() {
        // Coalesce rapid day changes: cancel the in-flight load so stale
        // results can't land after newer ones.
        reloadTask?.cancel()
        let forDay = day
        reloadTask = Task {
            do {
                async let e = state.client.listTimeEntries(from: forDay, to: forDay)
                async let s = state.client.timeSummary(date: forDay)
                let (entriesResult, summaryResult) = try await (e, s)
                if Task.isCancelled { return }
                await MainActor.run {
                    if day == forDay {
                        entries = entriesResult
                        summary = summaryResult
                    }
                }
            } catch {
                if !Task.isCancelled {
                    await MainActor.run { self.error = "Load failed: \(describe(error))" }
                }
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
        guard !key.isEmpty else { self.error = "Pick a subject before stopping."; return }
        if case .pile(let pid) = TimeSubjectKey.parse(key) {
            // Validate the pile still exists before logging against it.
            Task {
                do { _ = try await state.client.pile(id: pid) }
                catch { await MainActor.run { self.error = "That pile no longer exists — pick another subject." }; return }
                finishStop(at: at, key: key)
            }
            return
        }
        finishStop(at: at, key: key)
    }

    private func finishStop(at: Date, key: String) {
        let logKind = state.timerKind
        var t = TimerState(subjectKey: key, kind: logKind, startedAt: at)
        guard let minutes = t.stop(at: Date()), minutes >= 1 else { self.error = "Nothing to log yet."; return }
        Task {
            do {
                let iso = ISO8601DateFormatter()
                try await log(key: key, kind: logKind, minutes: max(1, minutes), date: localDayString(),
                              startedAt: iso.string(from: at), endedAt: iso.string(from: Date()))
                await MainActor.run { state.clearTimer(); reload() }
                await state.refreshTodayTotal()
            } catch {
                await MainActor.run { self.error = "Stop failed: \(describe(error))" }
            }
        }
    }

    private func useNewName() {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        let key = TimeSubjectKey.titleKey(title: name)
        customTitles[key] = name
        if let data = try? JSONEncoder().encode(customTitles) {
            UserDefaults.standard.set(data, forKey: "time_custom_titles")
        }
        selection = key
        newName = ""
    }

    /// Original-case title for a subject: recents first, then the pin
    /// label, then the raw key (matching the web resolve order).
    private func displayTitle(forKey key: String) -> String? {
        if let custom = customTitles[key], !custom.isEmpty { return custom }
        if let recent = subjects.first(where: { $0.key == key }) { return recent.title }
        if let pin = state.pins.first(where: { $0.id == key }),
           let label = pin.label, !label.isEmpty { return label }
        if case .title(let slug) = TimeSubjectKey.parse(key) { return slug }
        return nil
    }

    func log(key: String, kind: String, minutes: Int, date: String,
             startedAt: String? = nil, endedAt: String? = nil) async throws {
        let recent = subjects.first(where: { $0.key == key })
        let body: TimeEntryBody
        if let sub = TimeSubjectKey.parse(key) {
            switch sub {
            case .pile(let id):
                body = TimeEntryBody(title: recent?.title, pile: id,
                                     kind: kind, minutes: minutes, date: date,
                                     startedAt: startedAt, endedAt: endedAt)
            case .work(let id):
                body = TimeEntryBody(title: recent?.title, work: id,
                                     kind: kind, minutes: minutes, date: date,
                                     startedAt: startedAt, endedAt: endedAt)
            case .title:
                body = TimeEntryBody(title: displayTitle(forKey: key) ?? key,
                                     kind: kind, minutes: minutes, date: date,
                                     startedAt: startedAt, endedAt: endedAt)
            }
        } else {
            body = TimeEntryBody(title: key, kind: kind, minutes: minutes, date: date,
                                 startedAt: startedAt, endedAt: endedAt)
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
        if let wid = e.work?.id { return TimeSubjectKey.workKey(workId: wid) }
        return TimeSubjectKey.titleKey(title: e.title ?? "")
    }

    private func subjectTitle(of e: TimeEntry) -> String {
        e.pile?.name ?? e.work?.name ?? e.title ?? ""
    }

    private func subjectLabel(_ s: RecentSubject) -> String {
        s.pile?.name ?? s.work?.name ?? s.title ?? s.key
    }

    /// Normalised view over the four summary scopes.
    private var analysis: (total: Int, reading: Int, writing: Int, count: Int,
                           byDay: [DaySummary]?, byPile: [PileSubjectRow]?,
                           byWork: [WorkSubjectRow]?, byTitle: [TitleSubjectRow]?) {
        switch scope {
        case "week":
            let w = summary?.weekly
            return (w?.totalMinutes ?? 0, w?.readingMinutes ?? 0, w?.writingMinutes ?? 0,
                    w?.entryCount ?? 0, w?.byDay, w?.byPile, w?.byWork, w?.byTitle)
        case "last7":
            let s = summary?.last7
            return (s?.totalMinutes ?? 0, s?.readingMinutes ?? 0, s?.writingMinutes ?? 0,
                    s?.entryCount ?? 0, s?.byDay, s?.byPile, s?.byWork, s?.byTitle)
        case "month":
            let s = summary?.monthly
            return (s?.totalMinutes ?? 0, s?.readingMinutes ?? 0, s?.writingMinutes ?? 0,
                    s?.entryCount ?? 0, s?.byDay, s?.byPile, s?.byWork, s?.byTitle)
        default:
            let d = summary?.daily
            return (d?.totalMinutes ?? 0, d?.readingMinutes ?? 0, d?.writingMinutes ?? 0,
                    d?.entryCount ?? 0, nil, d?.byPile, d?.byWork, d?.byTitle)
        }
    }

    /// One quiet table row: serif name, then R/W/total as plain
    /// tabular text — never buttons.
    private func tableRow(name: String, reading: Int, writing: Int, total: Int, italicName: Bool = false) -> some View {
        HStack(spacing: 8) {
            Text(name)
                .font(DS.serif(13.5))
                .italic(italicName)
                .foregroundStyle(DS.ink)
                .lineLimit(1)
            Spacer()
            Text(formatMinutes(reading))
                .frame(width: 52, alignment: .trailing)
            Text(formatMinutes(writing))
                .frame(width: 52, alignment: .trailing)
            Text(formatMinutes(total))
                .frame(width: 52, alignment: .trailing)
                .foregroundStyle(DS.ink)
        }
        .font(DS.ui(12))
        .monospacedDigit()
        .foregroundStyle(DS.muted)
    }
}

/// Minutes beside a small-caps kind label (Reading/Writing never serif).
private struct KindMinutes: View {
    let kind: String
    let minutes: Int

    var body: some View {
        HStack(spacing: 4) {
            Text(kind.uppercased())
                .font(DS.ui(10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(DS.muted)
            Text(formatMinutes(minutes))
                .font(DS.ui(12))
                .monospacedDigit()
                .foregroundStyle(DS.ink)
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
                KindSubjectLine(
                    kind: entry.kind ?? "",
                    subject: entry.pile?.name ?? entry.work?.name ?? entry.title ?? ""
                )
                Text(formatMinutes(entry.minutes ?? 0))
                    .font(DS.ui(12))
                    .monospacedDigit()
                    .foregroundStyle(DS.muted)
                Spacer()
                Button { onStar() } label: { Image(systemName: "star") }
                    .buttonStyle(.borderless)
                    .foregroundStyle(DS.muted)
                DSButton(title: "Edit") {
                    title = entry.title ?? ""
                    minutes = String(entry.minutes ?? 0)
                    kind = entry.kind ?? "reading"
                    date = entry.date.map(dayString) ?? ""
                    editing.toggle()
                }
                DSButton(title: "Delete") { confirming = true }
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
    @State private var kind = "writing"
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
