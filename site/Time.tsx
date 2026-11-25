import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as db from './Database'
import { getPinnedItems, unpinItem } from './pinned'
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

  // Fill the form from a subject: a recent subject, or a starred one
  // arriving via /time?subject=... from the sidebar.
  const prefill = (subject: { key: string; title?: string; pile?: { id: string; name: string }; kind: string; minutes: number }) => {
    setEditingId(null)
    setError(null)
    setKind(subject.kind === 'reading' ? 'reading' : 'writing')
    setMinutes(String(subject.minutes))
    setDate(selectedDate)
    if (subject.pile) {
      setPileId(subject.pile.id)
      setPileName(subject.pile.name)
      setTitle(subject.title ?? '')
      setPileQuery('')
      setPileResults([])
    } else {
      setPileId(null)
      setPileName('')
      setTitle(subject.title ?? '')
    }
    window.scrollTo({ top: 0 })
  }

  const prefillByKey = async (key: string) => {
    const found = subjects.find((s: any) => s.key === key)
    if (found) {
      prefill(found)
      return
    }
    // Starred before anything recent covers it, or aged out: resolve the
    // key itself so the sidebar star still lands somewhere useful.
    if (key.startsWith('pile:')) {
      const id = key.slice(5)
      try {
        const res = await db.getInfo(db.types.pile, id)
        prefill({ key, pile: { id, name: res.data.data?.name ?? 'Pile' }, kind: 'writing', minutes: 30 })
      } catch {
        setError('That pile is gone; pick a title instead.')
      }
    } else if (key.startsWith('title:')) {
      const title = key.slice(6)
      if (title) prefill({ key, title, kind: 'reading', minutes: 30 })
    }
  }

  useEffect(() => {
    const key = params.get('subject')
    if (key && subjectApplied.current !== key && subjects.length) {
      subjectApplied.current = key
      prefillByKey(key)
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

  // One-tap logging for a starred subject: same kind and minutes as
  // last time, on the selected day. Falls back to prefilling the form
  // when the subject needs disambiguating (deleted pile, odd title).
  const logNow = async (subject: { key: string; title?: string; pile?: { id: string; name: string }; kind: string; minutes: number }) => {
    setError(null)
    const body: any = { kind: subject.kind, minutes: subject.minutes, date: selectedDate }
    if (subject.pile) {
      body.pile = subject.pile.id
      if (subject.title) body.title = subject.title
    } else {
      body.title = subject.title ?? 'Untitled'
    }
    try {
      await db.createTimeEntry(body)
      load(selectedDate)
    } catch (e: any) {
      prefill(subject)
      setError(e?.response?.data?.message ?? 'Could not log that; adjust the form and save.')
    }
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
    window.scrollTo({ top: 0 })
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

      <div className="time-form">
        <TopLevelSubTitle>{editingId ? 'Edit entry' : 'Log time'}</TopLevelSubTitle>
        <div className="time-form-grid">
          <label className="top-level form-label" htmlFor="time-title">Title</label>
          <input
            id="time-title"
            className="top-level input"
            placeholder="e.g. Morning pages"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="top-level form-label" htmlFor="time-pile">Pile</label>
          <div>
            {pileId ? (
              <div className="time-pile-pick">
                <Link to={'/pile/' + pileId}>{pileName}</Link>
                <button
                  className="button"
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
                  className="top-level input"
                  placeholder="Link a pile (optional)"
                  value={pileQuery}
                  onChange={(e) => setPileQuery(e.target.value)}
                />
                {pileResults.length > 0 || pileQuery.trim().length >= 2 ? (
                  <ul className="time-pile-results">
                    {pileResults.map((p: any) => (
                      <li key={p._id}>
                        <button className="button" onClick={() => pickPile(p._id, p.name)}>
                          {p.name}
                        </button>
                      </li>
                    ))}
                    {pileQuery.trim() ? (
                      <li>
                        <button className="button" onClick={createPile}>
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
                className={'button' + (kind === k ? ' button-selected' : '')}
                onClick={() => setKind(k)}
              >
                {k === 'reading' ? 'Reading' : 'Writing'}
              </button>
            ))}
          </div>
          <label className="top-level form-label" htmlFor="time-minutes">Minutes</label>
          <input
            id="time-minutes"
            className="top-level input"
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
            className="top-level input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {error ? <div className="time-error">{error}</div> : null}
        <TopLevelStandardButtonContainer>
          <TopLevelStandardButton
            name={editingId ? 'Save' : 'Log time'}
            position="left"
            onClick={save}
          />
          {editingId ? (
            <TopLevelStandardButton name="Cancel" position="right" onClick={resetForm} />
          ) : null}
        </TopLevelStandardButtonContainer>
      </div>

      {starred.length || subjects.length ? (
        <div className="time-shortcuts">
          {starred.length ? (
            <>
              <TopLevelSubTitle>Starred</TopLevelSubTitle>
              <ul className="time-entry-list">
                {starred.map((pin: any) => {
                  const subject = subjects.find((s: any) => s.key === pin.id)
                  const label = subject
                    ? subject.pile
                      ? subject.pile.name + (subject.title ? ` — ${subject.title}` : '')
                      : subject.title
                    : pin.label || pin.id
                  return (
                    <li key={pin.id} className="time-entry">
                      <span className="time-subject">
                        {subject?.pile ? (
                          <Link to={'/pile/' + subject.pile.id}>{label}</Link>
                        ) : (
                          label
                        )}
                      </span>
                      {subject ? (
                        <>
                          <span className={'time-kind time-kind-' + subject.kind}>{subject.kind}</span>
                          <span className="time-minutes">{formatMinutes(subject.minutes)}</span>
                          <span className="time-entry-actions">
                            <button className="button" onClick={() => logNow(subject)}>
                              Log {formatMinutes(subject.minutes)}
                            </button>
                            <button className="button" onClick={() => prefill(subject)}>
                              Fill form
                            </button>
                            <button className="button" onClick={() => unpinItem('time', pin.id)}>
                              Unstar
                            </button>
                          </span>
                        </>
                      ) : (
                        <span className="time-entry-actions">
                          <button className="button" onClick={() => prefillByKey(pin.id)}>
                            Fill form
                          </button>
                          <button className="button" onClick={() => unpinItem('time', pin.id)}>
                            Unstar
                          </button>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
          {subjects.filter((s: any) => !starred.some((p: any) => p.id === s.key)).length ? (
            <>
              <TopLevelSubTitle>Recent — tap to log again</TopLevelSubTitle>
              <ul className="time-entry-list">
                {subjects
                  .filter((s: any) => !starred.some((p: any) => p.id === s.key))
                  .map((s: any) => (
                    <li key={s.key} className="time-entry">
                      <span className="time-subject">
                        {s.pile ? <Link to={'/pile/' + s.pile.id}>{s.pile.name}</Link> : s.title}
                        {s.pile && s.title ? ` — ${s.title}` : null}
                      </span>
                      <span className={'time-kind time-kind-' + s.kind}>{s.kind}</span>
                      <span className="time-minutes">{formatMinutes(s.minutes)}</span>
                      <span className="time-entry-actions">
                        <button className="button" onClick={() => logNow(s)}>
                          Log {formatMinutes(s.minutes)}
                        </button>
                        <button className="button" onClick={() => prefill(s)}>
                          Fill form
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="time-day-nav">
        <TopLevelStandardButton
          name="‹ Prev"
          onClick={() => setSelectedDate(shiftDay(selectedDate, -1))}
        />
        <input
          aria-label="Selected day"
          className="top-level input time-date-input"
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
            <TopLevelSubTitle>Daily — {daily.date}</TopLevelSubTitle>
            <KindTotals summary={daily} />
            <CrossCheck reading={daily.readingMinutes} writing={daily.writingMinutes} total={daily.totalMinutes} />
            {daily.byPile.length ? (
              <>
                <div className="time-table-title">By pile</div>
                <SubjectTable rows={daily.byPile} pileLink />
              </>
            ) : null}
            {daily.byTitle.length ? (
              <>
                <div className="time-table-title">By title</div>
                <SubjectTable rows={daily.byTitle} />
              </>
            ) : null}
            {!daily.entryCount ? <div className="sidebar-muted">Nothing logged this day.</div> : null}
          </div>

          <div className="time-entries">
            <TopLevelSubTitle>Entries — {selectedDate}</TopLevelSubTitle>
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
                        <button className="button" onClick={() => edit(e)}>Edit</button>
                        <button className="button" onClick={() => remove(e)}>Delete</button>
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
            <TopLevelSubTitle>
              Weekly — {weekly.weekStart} to {weekly.weekEnd}
            </TopLevelSubTitle>
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
            <div className="time-table-title">By day</div>
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
                <div className="time-table-title">By pile</div>
                <SubjectTable rows={weekly.byPile} pileLink />
              </>
            ) : null}
            {weekly.byTitle.length ? (
              <>
                <div className="time-table-title">By title</div>
                <SubjectTable rows={weekly.byTitle} />
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

export default Time
