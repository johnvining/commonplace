import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as db from './Database'
import { getPinnedItems } from './pinned'
import PinButton from './PinButton'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import {
  TopLevelTitleContainer,
  TopLevelTitle,
  TopLevelSubTitle,
} from './TopLevelHeadings'

// Time logging: minutes spent reading or writing each day, labelled with a
// free-text title, a pile (the piece being read/written), or both. Daily and
// weekly summaries break the time down by kind and by subject, so a pile
// accumulates its reading vs writing time across days.

function toLocalDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayLocal(): string {
  return toLocalDay(new Date())
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const TIMER_STORAGE_KEY = 'time_timer_v1'

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

function shiftDay(date: string, delta: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return toLocalDay(d)
}

// Starred subjects are pins of type 'time' whose id is the subject key:
// `pile:<pileId>` for pile-linked time, `title:<lowercased title>` otherwise.
function subjectKeyFor(entry: any): { key: string; label: string; href: string } {
  const pileId = entry.pile?._id ? String(entry.pile._id) : entry.pile ? String(entry.pile) : null
  if (pileId && /^[0-9a-f]{24}$/i.test(pileId)) {
    const label = entry.pile?.name || entry.title?.trim() || 'Pile'
    return { key: `pile:${pileId}`, label, href: `/time?subject=${encodeURIComponent(`pile:${pileId}`)}` }
  }
  const title = (entry.title ?? '').trim() || 'Untitled'
  const key = `title:${title.toLowerCase()}`
  return { key, label: title, href: `/time?subject=${encodeURIComponent(key)}` }
}

// Reading + writing cross-check: the two kinds must sum to the total.
// Rendered on each summary so a mismatch is visible, not silent.
function CrossCheck({ reading, writing, total }: { reading: number; writing: number; total: number }) {
  const ok = reading + writing === total
  return (
    <div className={'time-crosscheck' + (ok ? '' : ' time-crosscheck-bad')}>
      cross-check: {formatMinutes(reading)} reading + {formatMinutes(writing)} writing ={' '}
      {formatMinutes(total)} total {ok ? '✓' : `✗ (sums to ${formatMinutes(reading + writing)})`}
    </div>
  )
}

function KindTotals({ summary }: { summary: any }) {
  return (
    <div className="time-kind-totals">
      <span className="time-total">{formatMinutes(summary.totalMinutes)} total</span>
      <span className="time-kind time-kind-reading">{formatMinutes(summary.readingMinutes)} reading</span>
      <span className="time-kind time-kind-writing">{formatMinutes(summary.writingMinutes)} writing</span>
      <span className="time-count">
        {summary.entryCount} {summary.entryCount === 1 ? 'entry' : 'entries'}
      </span>
    </div>
  )
}

function SubjectTable({ rows, pileLink }: { rows: any[]; pileLink?: boolean }) {
  if (!rows.length) return null
  return (
    <table className="time-table">
      <thead>
        <tr>
          <th>{pileLink ? 'Pile' : 'Title'}</th>
          <th>Reading</th>
          <th>Writing</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row: any, i: number) => (
          <tr key={i}>
            <td>
              {pileLink && row.pile ? (
                <Link to={'/pile/' + row.pile}>{row.name}</Link>
              ) : (
                row.name ?? row.title
              )}
            </td>
            <td>{formatMinutes(row.readingMinutes)}</td>
            <td>{formatMinutes(row.writingMinutes)}</td>
            <td>{formatMinutes(row.minutes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Time(props: any) {
  const [selectedDate, setSelectedDate] = useState(todayLocal())
  const [summary, setSummary] = useState<any>(null)
  const [dayEntries, setDayEntries] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [starred, setStarred] = useState<any[]>(() => getPinnedItems().filter((p) => p.type === 'time'))
  const [loading, setLoading] = useState(true)
  const [params, setParams] = useSearchParams()
  const subjectApplied = useRef<string | null>(null)
  const [timerKey, setTimerKey] = useState('')
  const [timerQuery, setTimerQuery] = useState('')
  const [timerOpen, setTimerOpen] = useState(false)
  const [timerPiles, setTimerPiles] = useState<any[]>([])
  const [timerKind, setTimerKind] = useState('writing')
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [manualOpen, setManualOpen] = useState(false)
  const formRef = useRef<HTMLDivElement | null>(null)

  // Log form state
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('writing')
  const [minutes, setMinutes] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [pileId, setPileId] = useState<string | null>(null)
  const [pileName, setPileName] = useState('')
  const [pileQuery, setPileQuery] = useState('')
  const [pileResults, setPileResults] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async (day: string) => {
    setLoading(true)
    try {
      const [summaryRes, entriesRes, subjectsRes] = await Promise.all([
        db.getTimeSummary(day),
        db.getTimeEntries({ from: day, to: day }),
        db.getRecentSubjects(20),
      ])
      setSummary(summaryRes.data.data)
      setDayEntries(entriesRes.data.data)
      setSubjects(subjectsRes.data.data)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    const refresh = () => setStarred(getPinnedItems().filter((p) => p.type === 'time'))
    window.addEventListener('pinned-items-updated', refresh)
    return () => window.removeEventListener('pinned-items-updated', refresh)
  }, [])

  // A running timer survives reloads: pick it back up on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!raw) return
      const t = JSON.parse(raw)
      if (
        t &&
        typeof t.key === 'string' &&
        t.key &&
        (t.kind === 'reading' || t.kind === 'writing') &&
        Number.isFinite(t.startedAt)
      ) {
        setTimerKey(t.key)
        setTimerKind(t.kind)
        setTimerStartedAt(t.startedAt)
      }
    } catch {}
  }, [])

  // Tick the elapsed display while the timer runs.
  useEffect(() => {
    if (timerStartedAt === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timerStartedAt])

  // The timer's subject, resolved against recents first (original-case
  // titles, pile names), then starred pins, then the raw key.
  const resolveTimerSubject = (
    key: string
  ): { key: string; title?: string; pileId?: string } | null => {
    if (!key) return null
    const recent = subjects.find((s: any) => s.key === key)
    if (recent) return { key, title: recent.title, pileId: recent.pile?.id }
    if (key.startsWith('pile:')) {
      const id = key.slice(5)
      if (!/^[0-9a-f]{24}$/i.test(id)) return null
      return { key, pileId: id }
    }
    if (key.startsWith('title:') && key.length > 6) {
      const pin = starred.find((p: any) => p.id === key)
      return { key, title: pin?.label || key.slice(6) }
    }
    return null
  }

  const selectTimerKey = (key: string) => {
    setTimerKey(key)
    if (key) setTimerQuery(subjectLabelForKey(key))
    const recent = subjects.find((s: any) => s.key === key)
    if (recent) setTimerKind(recent.kind === 'writing' ? 'writing' : 'reading')
  }

  const subjectLabelForKey = (key: string): string => {
    const s = subjects.find((x: any) => x.key === key)
    if (s) return s.pile ? s.pile.name + (s.title ? ` — ${s.title}` : '') : s.title ?? key
    const pin = starred.find((p: any) => p.id === key)
    if (pin?.label) return pin.label
    if (key.startsWith('title:')) return key.slice(6)
    return key
  }

  const pickTimerSubject = (key: string, label: string) => {
    selectTimerKey(key)
    setTimerQuery(label)
    setTimerOpen(false)
  }

  const useTypedTimerName = () => {
    const name = timerQuery.trim()
    if (!name) return
    pickTimerSubject(`title:${name.toLowerCase()}`, name)
  }

  // Pile matches for the timer picker, debounced like the other pickers.
  useEffect(() => {
    const q = timerQuery.trim()
    if (!timerOpen || q.length < 2 || timerKey) {
      setTimerPiles([])
      return
    }
    const t = setTimeout(() => {
      db.getSuggestions('pile', q)
        .then((res: any) => setTimerPiles(res.data.data ?? []))
        .catch(() => setTimerPiles([]))
    }, 250)
    return () => clearTimeout(t)
  }, [timerQuery, timerOpen, timerKey])

  const startTimer = () => {
    if (timerStartedAt !== null || !resolveTimerSubject(timerKey)) return
    const startedAt = Date.now()
    setTimerStartedAt(startedAt)
    setNow(startedAt)
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ key: timerKey, kind: timerKind, startedAt }))
    } catch {}
  }

  const stopTimer = async () => {
    if (timerStartedAt === null) return
    const subject = resolveTimerSubject(timerKey)
    const elapsedMin = Math.max(1, Math.round((Date.now() - timerStartedAt) / 60000))
    setTimerStartedAt(null)
    try {
      localStorage.removeItem(TIMER_STORAGE_KEY)
    } catch {}
    if (!subject || (!subject.pileId && !subject.title)) {
      setError('Pick what this time was for first.')
      return
    }
    // A pile star can outlive its pile; check before logging.
    if (subject.pileId) {
      try {
        await db.getInfo(db.types.pile, subject.pileId)
      } catch {
        setError('That pile is gone; pick something else.')
        return
      }
    }
    setError(null)
    const body: any = { kind: timerKind, minutes: elapsedMin, date: todayLocal() }
    if (subject.pileId) body.pile = subject.pileId
    if (subject.title) body.title = subject.title
    try {
      await db.createTimeEntry(body)
      load(selectedDate)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not save that entry.')
    }
  }

  // A sidebar star lands here via /time?subject=...: select it in the
  // timer row once subjects have loaded.
  useEffect(() => {
    const key = params.get('subject')
    if (key && subjectApplied.current !== key && (subjects.length || starred.length)) {
      subjectApplied.current = key
      selectTimerKey(key)
      setParams({}, { replace: true })
    }
  })

  // Pile picker: search existing piles, or create the typed name.
  useEffect(() => {
    const q = pileQuery.trim()
    if (q.length < 2) {
      setPileResults([])
      return
    }
    const timer = setTimeout(() => {
      db.getSuggestions('pile', q)
        .then((res: any) => setPileResults(res.data.data ?? []))
        .catch(() => setPileResults([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [pileQuery])

  const pickPile = (id: string, name: string) => {
    setPileId(id)
    setPileName(name)
    setPileQuery('')
    setPileResults([])
  }

  const createPile = async () => {
    const name = pileQuery.trim()
    if (!name) return
    const res = await db.createRecord('pile', name)
    pickPile(res.data.data._id, res.data.data.name)
  }

  const resetForm = () => {
    setTitle('')
    setKind('writing')
    setMinutes('')
    setDate(selectedDate)
    setPileId(null)
    setPileName('')
    setPileQuery('')
    setPileResults([])
    setEditingId(null)
    setError(null)
    setManualOpen(false)
  }

  const save = async () => {
    const mins = Number(minutes)
    if (!title.trim() && !pileId) {
      setError('Give the entry a title or a pile.')
      return
    }
    if (!Number.isInteger(mins) || mins < 1) {
      setError('Minutes must be a whole number of at least 1.')
      return
    }
    if (!date) {
      setError('Pick the day this time belongs to.')
      return
    }
    setError(null)
    const body = {
      title: title.trim(),
      pile: pileId,
      kind,
      minutes: mins,
      date,
    }
    if (editingId) {
      await db.updateRecord(db.types.time, editingId, body)
    } else {
      await db.createTimeEntry(body)
    }
    resetForm()
    load(selectedDate)
  }

  const edit = (entry: any) => {
    setEditingId(entry._id)
    setTitle(entry.title ?? '')
    setKind(entry.kind)
    setMinutes(String(entry.minutes))
    setDate(new Date(entry.date).toISOString().slice(0, 10))
    if (entry.pile?._id) {
      setPileId(entry.pile._id)
      setPileName(entry.pile.name ?? '')
    } else {
      setPileId(null)
      setPileName('')
    }
    setError(null)
    setManualOpen(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const remove = async (entry: any) => {
    const label = entry.pile?.name || entry.title || 'this entry'
    if (!confirm(`Delete ${entry.minutes}m of ${entry.kind} on '${label}'?`)) return
    await db.deleteRecord(db.types.time, entry._id)
    if (editingId === entry._id) resetForm()
    load(selectedDate)
  }

  props.setPageTitle('Time')

  const weekly = summary?.weekly
  const daily = summary?.daily
  const weekDaySum = weekly?.byDay?.reduce((n: number, d: any) => n + d.totalMinutes, 0) ?? 0

  return (
    <div>
      <TopLevelTitleContainer>
        <TopLevelTitle>Time</TopLevelTitle>
        <TopLevelSubTitle>Reading vs writing, logged by day and tallied by piece.</TopLevelSubTitle>
      </TopLevelTitleContainer>

      <div className="time-card time-timer">
        <div className="time-timer-row">
          <div className="time-subject-picker">
            {timerKey ? (
              <div className="time-subject-chip">
                <span>{subjectLabelForKey(timerKey)}</span>
                <button
                  aria-label="Clear subject"
                  onClick={() => {
                    setTimerKey('')
                    setTimerQuery('')
                    setTimerOpen(true)
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <input
                  aria-label="What the time is for — type a name, a recent subject, or a pile"
                  className="top-level input compact time-subject-select"
                  placeholder="Type a name, pick a recent, or search a pile…"
                  value={timerQuery}
                  onChange={(e) => {
                    setTimerQuery(e.target.value)
                    setTimerOpen(true)
                  }}
                  onFocus={() => setTimerOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') useTypedTimerName()
                    if (e.key === 'Escape') setTimerOpen(false)
                  }}
                />
                {timerOpen ? (
                  <ul className="time-subject-list">
                    {starred.map((pin: any) => {
                      const s = subjects.find((x: any) => x.key === pin.id)
                      const label = s
                        ? s.pile
                          ? s.pile.name + (s.title ? ` — ${s.title}` : '')
                          : s.title
                        : pin.label || pin.id
                      return (
                        <li key={'star-' + pin.id}>
                          <button onClick={() => pickTimerSubject(pin.id, label)}>★ {label}</button>
                        </li>
                      )
                    })}
                    {subjects
                      .filter((s: any) => !starred.some((p: any) => p.id === s.key))
                      .filter(
                        (s: any) =>
                          !timerQuery.trim() ||
                          (s.pile?.name ?? s.title ?? '').toLowerCase().includes(timerQuery.trim().toLowerCase())
                      )
                      .map((s: any) => {
                        const label = s.pile ? s.pile.name + (s.title ? ` — ${s.title}` : '') : s.title
                        return (
                          <li key={'recent-' + s.key}>
                            <button onClick={() => pickTimerSubject(s.key, label)}>{label}</button>
                          </li>
                        )
                      })}
                    {timerPiles.map((p: any) => (
                      <li key={'pile-' + p._id}>
                        <button onClick={() => pickTimerSubject(`pile:${p._id}`, p.name)}>
                          Pile: {p.name}
                        </button>
                      </li>
                    ))}
                    {timerQuery.trim() ? (
                      <li>
                        <button onClick={useTypedTimerName}>Use “{timerQuery.trim()}” as a name</button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </>
            )}
          </div>
          <div className="time-kind-toggle" role="group" aria-label="Reading or writing">
            {['reading', 'writing'].map((k) => (
              <button
                key={k}
                className={'button compact' + (timerKind === k ? ' button-selected' : '')}
                onClick={() => timerStartedAt === null && setTimerKind(k)}
              >
                {k === 'reading' ? 'Reading' : 'Writing'}
              </button>
            ))}
          </div>
          {timerStartedAt !== null ? (
            <>
              <span className="time-elapsed">{formatElapsed(now - timerStartedAt)}</span>
              <TopLevelStandardButton name="Stop" className="compact" onClick={stopTimer} />
            </>
          ) : (
            <button
              className="button compact"
              disabled={!resolveTimerSubject(timerKey)}
              title={resolveTimerSubject(timerKey) ? 'Start timer' : 'Pick or type a subject first'}
              onClick={startTimer}
            >
              Start
            </button>
          )}
        </div>
        {timerStartedAt !== null ? (
          <div className="sidebar-muted">Timing {timerKind} — stopping logs it to today.</div>
        ) : null}
        {error ? <div className="time-error">{error}</div> : null}
      </div>


      <div className="time-day-nav">
        <TopLevelStandardButton
          name="‹ Prev"
          onClick={() => setSelectedDate(shiftDay(selectedDate, -1))}
        />
        <input
          aria-label="Selected day"
          className="top-level input compact time-date-input"
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
        />
        <TopLevelStandardButton
          name="Next ›"
          onClick={() => setSelectedDate(shiftDay(selectedDate, 1))}
        />
        <TopLevelStandardButton name="Today" onClick={() => setSelectedDate(todayLocal())} />
      </div>

      {loading || !summary ? (
        <div className="search-empty-state">Loading…</div>
      ) : (
        <>
          <div className="time-card">
            <div className="top-level form-label">Daily — {daily.date}</div>
            <KindTotals summary={daily} />
            <CrossCheck reading={daily.readingMinutes} writing={daily.writingMinutes} total={daily.totalMinutes} />
            {daily.byPile.length ? (
              <>
                <div className="top-level form-label time-table-title">By pile</div>
                <SubjectTable rows={daily.byPile} pileLink />
              </>
            ) : null}
            {daily.byTitle.length ? (
              <>
                <div className="top-level form-label time-table-title">By title</div>
                <SubjectTable rows={daily.byTitle} />
              </>
            ) : null}
            {!daily.entryCount ? <div className="sidebar-muted">Nothing logged this day.</div> : null}
          </div>

          <div className="time-entries">
            <div className="top-level form-label">Entries — {selectedDate}</div>
            {dayEntries.length ? (
              <ul className="time-entry-list">
                {dayEntries.map((e: any) => {
                  const subject = subjectKeyFor(e)
                  return (
                    <li key={e._id} className="time-entry">
                      <span className={'time-kind time-kind-' + e.kind}>{e.kind}</span>
                      <span className="time-minutes">{formatMinutes(e.minutes)}</span>
                      <span className="time-subject">
                        {e.pile?._id ? (
                          <>
                            <Link to={'/pile/' + (e.pile._id ?? e.pile)}>{e.pile.name ?? 'Pile'}</Link>
                            {e.title ? ` — ${e.title}` : null}
                          </>
                        ) : (
                          e.title || 'Untitled'
                        )}
                      </span>
                      <span className="time-entry-actions">
                        <PinButton
                          type="time"
                          id={subject.key}
                          label={subject.label}
                          href={subject.href}
                          compact
                        />
                        <button className="button compact" onClick={() => edit(e)}>Edit</button>
                        <button className="button compact" onClick={() => remove(e)}>Delete</button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="sidebar-muted">No entries this day.</div>
            )}
          </div>

          <div className="time-card">
            <div className="top-level form-label">
              Weekly — {weekly.weekStart} to {weekly.weekEnd}
            </div>
            <KindTotals summary={weekly} />
            <CrossCheck reading={weekly.readingMinutes} writing={weekly.writingMinutes} total={weekly.totalMinutes} />
            <div
              className={
                'time-crosscheck' + (weekDaySum === weekly.totalMinutes ? '' : ' time-crosscheck-bad')
              }
            >
              cross-check: 7 days sum to {formatMinutes(weekDaySum)}{' '}
              {weekDaySum === weekly.totalMinutes ? '✓' : `✗ (week total ${formatMinutes(weekly.totalMinutes)})`}
            </div>
            <div className="top-level form-label time-table-title">By day</div>
            <table className="time-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Reading</th>
                  <th>Writing</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {weekly.byDay.map((d: any) => (
                  <tr key={d.date} className={d.date === selectedDate ? 'time-today' : undefined}>
                    <td>
                      <button className="time-day-link" onClick={() => setSelectedDate(d.date)}>
                        {d.date}
                      </button>
                    </td>
                    <td>{formatMinutes(d.readingMinutes)}</td>
                    <td>{formatMinutes(d.writingMinutes)}</td>
                    <td>{formatMinutes(d.totalMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {weekly.byPile.length ? (
              <>
                <div className="top-level form-label time-table-title">By pile</div>
                <SubjectTable rows={weekly.byPile} pileLink />
              </>
            ) : null}
            {weekly.byTitle.length ? (
              <>
                <div className="top-level form-label time-table-title">By title</div>
                <SubjectTable rows={weekly.byTitle} />
              </>
            ) : null}
          </div>

          <details
            className="time-manual"
            open={manualOpen}
            onToggle={(e: any) => setManualOpen(e.currentTarget.open)}
          >
            <summary className="top-level form-label">Log manually</summary>
            <div ref={formRef} className="time-form">
              <div className="time-form-grid">
                <label className="top-level form-label" htmlFor="time-title">Title</label>
                <input
                  id="time-title"
                  className="top-level input compact"
                  placeholder="e.g. Morning pages"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <label className="top-level form-label" htmlFor="time-pile">Pile</label>
                <div>
                  {pileId ? (
                    <div className="time-pile-pick compact">
                      <Link to={'/pile/' + pileId}>{pileName}</Link>
                      <button
                        className="button compact"
                        onClick={() => {
                          setPileId(null)
                          setPileName('')
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        id="time-pile"
                        className="top-level input compact"
                        placeholder="Link a pile (optional)"
                        value={pileQuery}
                        onChange={(e) => setPileQuery(e.target.value)}
                      />
                      {pileResults.length > 0 || pileQuery.trim().length >= 2 ? (
                        <ul className="time-pile-results">
                          {pileResults.map((p: any) => (
                            <li key={p._id}>
                              <button className="button compact" onClick={() => pickPile(p._id, p.name)}>
                                {p.name}
                              </button>
                            </li>
                          ))}
                          {pileQuery.trim() ? (
                            <li>
                              <button className="button compact" onClick={createPile}>
                                New pile: {pileQuery.trim()}
                              </button>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </>
                  )}
                </div>
                <span className="top-level form-label">Kind</span>
                <div className="time-kind-toggle" role="group" aria-label="Reading or writing">
                  {['reading', 'writing'].map((k) => (
                    <button
                      key={k}
                      className={'button compact' + (kind === k ? ' button-selected' : '')}
                      onClick={() => setKind(k)}
                    >
                      {k === 'reading' ? 'Reading' : 'Writing'}
                    </button>
                  ))}
                </div>
                <label className="top-level form-label" htmlFor="time-minutes">Minutes</label>
                <input
                  id="time-minutes"
                  className="top-level input compact"
                  type="number"
                  min="1"
                  max="1440"
                  placeholder="e.g. 45"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
                <label className="top-level form-label" htmlFor="time-date">Day</label>
                <input
                  id="time-date"
                  className="top-level input compact"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {error ? <div className="time-error">{error}</div> : null}
              <TopLevelStandardButtonContainer>
                <TopLevelStandardButton
                  name={editingId ? 'Save' : 'Log time'}
                  className="compact"
                  onClick={save}
                />
                {editingId ? (
                  <TopLevelStandardButton name="Cancel" className="compact" onClick={resetForm} />
                ) : null}
              </TopLevelStandardButtonContainer>
            </div>
          </details>
        </>
      )}
    </div>
  )
}

export default Time
