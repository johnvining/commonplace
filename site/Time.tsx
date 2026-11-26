import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as db from './Database'
import { getPinnedItems } from './pinned'
import PinButton from './PinButton'
import { PileLabel } from './PilesPillList'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
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
// `pile:<pileId>`, `work:<workId>`, or `title:<lowercased title>`.
function subjectKeyFor(entry: any): { key: string; label: string; href: string } {
  const pileId = entry.pile?._id ? String(entry.pile._id) : entry.pile ? String(entry.pile) : null
  if (pileId && /^[0-9a-f]{24}$/i.test(pileId)) {
    const label = entry.pile?.name || entry.title?.trim() || 'Pile'
    return { key: `pile:${pileId}`, label, href: `/time?subject=${encodeURIComponent(`pile:${pileId}`)}` }
  }
  const workId = entry.work?._id ? String(entry.work._id) : entry.work ? String(entry.work) : null
  if (workId && /^[0-9a-f]{24}$/i.test(workId)) {
    const label = entry.work?.name || entry.title?.trim() || 'Work'
    return { key: `work:${workId}`, label, href: `/time?subject=${encodeURIComponent(`work:${workId}`)}` }
  }
  const title = (entry.title ?? '').trim() || 'Untitled'
  const key = `title:${title.toLowerCase()}`
  return { key, label: title, href: `/time?subject=${encodeURIComponent(key)}` }
}


function KindTotals({ summary }: { summary: any }) {
  const total = summary.totalMinutes || 0
  const readingPct = total ? Math.round((summary.readingMinutes / total) * 100) : 0
  return (
    <div className="time-kind-block">
      <div className="time-kind-totals">
        <span className="time-total">{formatMinutes(summary.totalMinutes)} total</span>
        <span className="time-kind time-kind-reading">{formatMinutes(summary.readingMinutes)} Reading</span>
        <span className="time-kind time-kind-writing">{formatMinutes(summary.writingMinutes)} Writing</span>
        <span className="time-count">
          {summary.entryCount} {summary.entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      {total ? (
        <div className="time-split" role="img" aria-label={`${readingPct}% reading, ${100 - readingPct}% writing`}>
          <span className="time-split-reading" style={{ width: `${readingPct}%` }} />
          <span className="time-split-writing" style={{ width: `${100 - readingPct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function SubjectTable({
  rows,
  pileLink,
  workLink,
}: {
  rows: any[]
  pileLink?: boolean
  workLink?: boolean
}) {
  if (!rows.length) return null
  return (
    <table className="time-table">
      <thead>
        <tr>
          <th>{pileLink ? 'Pile' : workLink ? 'Work' : 'Title'}</th>
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
                <Link to={'/pile/' + row.pile}><span className="time-pile-pill"><PileLabel name={row.name} /></span></Link>
              ) : workLink && row.work ? (
                <Link to={'/work/' + row.work}>
                  <em>{row.name}</em>
                </Link>
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
  const [timerLabel, setTimerLabel] = useState('')
  const [timerOpen, setTimerOpen] = useState(false)
  const [timerPiles, setTimerPiles] = useState<any[]>([])
  const [timerWorks, setTimerWorks] = useState<any[]>([])
  const [timerHighlight, setTimerHighlight] = useState(0)
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
  const [workId, setWorkId] = useState<string | null>(null)
  const [workName, setWorkName] = useState('')
  const [workQuery, setWorkQuery] = useState('')
  const [workResults, setWorkResults] = useState<any[]>([])
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
  ): { key: string; title?: string; pileId?: string; workId?: string } | null => {
    if (!key) return null
    const recent = subjects.find((s: any) => s.key === key)
    if (recent) return { key, title: recent.title, pileId: recent.pile?.id, workId: recent.work?.id }
    if (key.startsWith('work:')) {
      const id = key.slice(5)
      if (!/^[0-9a-f]{24}$/i.test(id)) return null
      return { key, workId: id }
    }
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
    if (s) return s.pile ? s.pile.name + (s.title ? ` — ${s.title}` : '') : s.work ? s.work.name + (s.title ? ` — ${s.title}` : '') : s.title ?? key
    const pin = starred.find((p: any) => p.id === key)
    if (pin?.label) return pin.label
    if (key.startsWith('title:')) return key.slice(6)
    return key
  }

  // Once recents arrive, replace a raw key label with the real name.
  useEffect(() => {
    if (timerKey && subjects.length && (!timerLabel || timerLabel === timerKey)) {
      setTimerLabel(subjectLabelForKey(timerKey))
    }
    // A pile picked by deep link may not be in recents: fetch its name.
    if (timerKey.startsWith('pile:') && (!timerLabel || timerLabel === timerKey)) {
      const id = timerKey.slice(5)
      db.getInfo(db.types.pile, id)
        .then((res: any) => {
          const name = res.data.data?.name
          if (name) setTimerLabel(name)
        })
        .catch(() => {})
    }
    if (timerKey.startsWith('work:') && (!timerLabel || timerLabel === timerKey)) {
      const id = timerKey.slice(5)
      db.getInfo(db.types.work, id)
        .then((res: any) => {
          const name = res.data.data?.name
          if (name) setTimerLabel(name)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, timerKey])

  const pickTimerSubject = (key: string, label: string) => {
    selectTimerKey(key)
    setTimerQuery(label)
    setTimerLabel(label)
    setTimerOpen(false)
  }

  // Flat option list shared by rendering and keyboard navigation.
  const timerOptions = (): { key: string; label: string }[] => {
    const out: { key: string; label: string }[] = []
    for (const pin of starred) {
      const s = subjects.find((x: any) => x.key === pin.id)
      const label = s
        ? s.pile
          ? s.pile.name + (s.title ? ` — ${s.title}` : '')
          : s.title
        : pin.label || pin.id
      out.push({ key: pin.id, label: `★ ${label}` })
    }
    const q = timerQuery.trim().toLowerCase()
    for (const s of subjects.filter(
      (x: any): boolean =>
        !starred.some((p: any) => p.id === x.key) &&
        (!q || (x.pile?.name ?? x.title ?? '').toLowerCase().includes(q))
    ) as any[]) {
      out.push({
        key: s.key,
        label: s.pile ? s.pile.name + (s.title ? ` — ${s.title}` : '') : s.title,
      })
    }
    for (const p of timerPiles) out.push({ key: `pile:${p._id}`, label: `Pile: ${p.name}` })
    for (const w of timerWorks) out.push({ key: `work:${w._id}`, label: `Work: ${w.name}` })
    if (timerQuery.trim()) out.push({ key: `title:${timerQuery.trim().toLowerCase()}`, label: `Use “${timerQuery.trim()}” as a name` })
    return out
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
      setTimerWorks([])
      return
    }
    const t = setTimeout(() => {
      db.getSuggestions('pile', q)
        .then((res: any) => setTimerPiles(res.data.data ?? []))
        .catch(() => setTimerPiles([]))
      db.getSuggestions('work', q)
        .then((res: any) => setTimerWorks(res.data.data ?? []))
        .catch(() => setTimerWorks([]))
    }, 250)
    return () => clearTimeout(t)
  }, [timerQuery, timerOpen, timerKey])

  const startTimerFor = (key: string, kind: string) => {
    if (timerStartedAt !== null || !resolveTimerSubject(key)) return
    const startedAt = Date.now()
    setTimerKey(key)
    setTimerKind(kind)
    setTimerStartedAt(startedAt)
    setNow(startedAt)
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ key, kind, startedAt }))
    } catch {}
  }

  const startTimer = () => startTimerFor(timerKey, timerKind)

  const startAgain = (entry: any) => {
    const { key, label } = subjectKeyFor(entry)
    pickTimerSubject(key, label)
    startTimerFor(key, entry.kind === 'reading' ? 'reading' : 'writing')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stopTimer = async () => {
    if (timerStartedAt === null) return
    const subject = resolveTimerSubject(timerKey)
    const elapsedMin = Math.max(1, Math.round((Date.now() - timerStartedAt) / 60000))
    // Validate before clearing: a failed stop keeps the timer running.
    if (!subject || (!subject.pileId && !subject.workId && !subject.title)) {
      setError('Pick what this time was for first.')
      return
    }
    // A pile/work star can outlive its record; check before logging.
    if (subject.pileId) {
      try {
        await db.getInfo(db.types.pile, subject.pileId)
      } catch {
        setError('That pile is gone; pick something else.')
        return
      }
    }
    if (subject.workId) {
      try {
        await db.getInfo(db.types.work, subject.workId)
      } catch {
        setError('That work is gone; pick something else.')
        return
      }
    }
    setError(null)
    const body: any = {
      kind: timerKind,
      minutes: elapsedMin,
      date: todayLocal(),
      startedAt: new Date(timerStartedAt).toISOString(),
      endedAt: new Date().toISOString(),
    }
    if (subject.pileId) body.pile = subject.pileId
    if (subject.workId) body.work = subject.workId
    if (subject.title) body.title = subject.title
    try {
      await db.createTimeEntry(body)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not save that entry.')
      return
    }
    setTimerStartedAt(null)
    try {
      localStorage.removeItem(TIMER_STORAGE_KEY)
    } catch {}
    load(selectedDate)
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

  useEffect(() => {
    const q = workQuery.trim()
    if (q.length < 2) {
      setWorkResults([])
      return
    }
    const timer = setTimeout(() => {
      db.getSuggestions('work', q)
        .then((res: any) => setWorkResults(res.data.data ?? []))
        .catch(() => setWorkResults([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [workQuery])

  const pickWork = (id: string, name: string) => {
    setWorkId(id)
    setWorkName(name)
    setWorkQuery('')
    setWorkResults([])
  }

  const createWork = async () => {
    const name = workQuery.trim()
    if (!name) return
    const res = await db.createRecord('work', name)
    pickWork(res.data.data._id, res.data.data.name)
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
    setWorkId(null)
    setWorkName('')
    setWorkQuery('')
    setWorkResults([])
    setEditingId(null)
    setError(null)
    setManualOpen(false)
  }

  const save = async () => {
    const mins = Number(minutes)
    if (!title.trim() && !pileId && !workId) {
      setError('Give the entry a title, a pile, or a work.')
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
      work: workId,
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
    if (entry.work?._id) {
      setWorkId(entry.work._id)
      setWorkName(entry.work.name ?? '')
    } else {
      setWorkId(null)
      setWorkName('')
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
  const [analysisScope, setAnalysisScope] = useState<'today' | 'week' | 'last7' | 'month'>('today')
  const scoped =
    analysisScope === 'today'
      ? daily
      : analysisScope === 'week'
        ? weekly
        : analysisScope === 'last7'
          ? summary?.last7
          : summary?.monthly
  const scopeWhen =
    analysisScope === 'today'
      ? daily?.date
      : analysisScope === 'week'
        ? `${weekly?.weekStart} – ${weekly?.weekEnd}`
        : `${scoped?.start} – ${scoped?.end}`

  return (
    <div>
      <div className="time-card time-timer">
      <div className="top-level form-label time-section-head">Start Entry</div>
        <div className="time-timer-row">
          <div className="time-subject-picker">
            {timerKey ? (
              <div className={'time-subject-chip' + (timerKey.startsWith('pile:') ? ' time-pile-pill' : '')}>
                <span>{timerKey.startsWith('pile:') ? <PileLabel name={timerLabel || subjectLabelForKey(timerKey)} /> : timerLabel || subjectLabelForKey(timerKey)}</span>
                <button
                  aria-label="Clear subject"
                  onClick={() => {
                    setTimerKey('')
                    setTimerQuery('')
                    setTimerLabel('')
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
                    setTimerHighlight(0)
                  }}
                  onFocus={() => setTimerOpen(true)}
                  onKeyDown={(e) => {
                    const opts = timerOptions()
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setTimerOpen(true)
                      setTimerHighlight((h) => Math.min(Math.max(opts.length - 1, 0), h + 1))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setTimerHighlight((h) => Math.max(0, h - 1))
                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                      const opt = opts[timerHighlight]
                      if (opt && timerOpen) {
                        e.preventDefault()
                        if (opt.label.startsWith('Use ')) useTypedTimerName()
                        else pickTimerSubject(opt.key, opt.label.replace(/^★ /, '').replace(/^Pile: /, '').replace(/^Work: /, ''))
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        useTypedTimerName()
                      }
                    } else if (e.key === 'Escape') {
                      setTimerOpen(false)
                    }
                  }}
                />
                {timerOpen ? (
                  <ul className="time-subject-list" role="listbox">
                    {timerOptions().map((opt, i) => (
                      <li key={opt.key + '-' + i}>
                        <button
                          role="option"
                          aria-selected={i === timerHighlight}
                          className={i === timerHighlight ? 'highlighted' : ''}
                          onMouseEnter={() => setTimerHighlight(i)}
                          onClick={() => {
                            if (opt.label.startsWith('Use ')) useTypedTimerName()
                            else pickTimerSubject(opt.key, opt.label.replace(/^★ /, '').replace(/^Pile: /, '').replace(/^Work: /, ''))
                          }}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                    {!timerOptions().length ? (
                      <li className="time-subject-empty">No matches — type a name and press Enter.</li>
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


      {loading || !summary ? (
        <div className="search-empty-state">Loading…</div>
      ) : (
        <>
          <div className="time-entries">
            <div className="time-entries-head">
              <div className="top-level form-label time-section-head">
                {selectedDate === todayLocal() ? 'Today' : selectedDate}
              </div>
              <div className="time-day-nav">
                <button
                  className="button compact"
                  aria-label="Previous day"
                  onClick={() => setSelectedDate(shiftDay(selectedDate, -1))}
                >
                  ‹
                </button>
                <input
                  aria-label="Selected day"
                  className="top-level input compact time-date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                />
                <button
                  className="button compact"
                  aria-label="Next day"
                  onClick={() => setSelectedDate(shiftDay(selectedDate, 1))}
                >
                  ›
                </button>
                <button className="button compact" onClick={() => setSelectedDate(todayLocal())}>
                  Today
                </button>
              </div>
            </div>
            {dayEntries.length ? (
              <ul className="time-entry-list">
                {dayEntries.map((e: any) => {
                  const subject = subjectKeyFor(e)
                  return (
                    <li key={e._id} className="time-entry">
                      <span className={'time-kind time-kind-' + e.kind}>
                        {e.kind === 'reading' ? 'Reading' : 'Writing'}
                      </span>
                      <span className="time-minutes">{formatMinutes(e.minutes)}</span>
                      <span className="time-subject">
                        {e.pile?._id ? (
                          <>
                            <Link to={'/pile/' + (e.pile._id ?? e.pile)}><span className="time-pile-pill"><PileLabel name={e.pile.name ?? 'Pile'} /></span></Link>
                            {e.work?._id ? (
                              <>
                                {' · '}
                                <Link to={'/work/' + e.work._id}>
                                  <em>{e.work.name ?? 'Work'}</em>
                                </Link>
                              </>
                            ) : null}
                            {e.title ? ` — ${e.title}` : null}
                          </>
                        ) : e.work?._id ? (
                          <>
                            <Link to={'/work/' + e.work._id}>
                              <em>{e.work.name ?? 'Work'}</em>
                            </Link>
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
                        <button
                          className="button compact"
                          disabled={timerStartedAt !== null}
                          title={timerStartedAt !== null ? 'Stop the running timer first' : 'Start this again'}
                          onClick={() => startAgain(e)}
                        >
                          Start again
                        </button>
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


          <div className="time-card time-analysis">
          <div className="top-level form-label time-section-head">Analysis</div>
            <div className="time-scope-tabs" role="tablist" aria-label="Analysis range">
              {(
                [
                  ['today', 'Today'],
                  ['week', 'This week'],
                  ['last7', 'Last 7 days'],
                  ['month', 'This month'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={analysisScope === key}
                  className={'button compact' + (analysisScope === key ? ' button-selected' : '')}
                  onClick={() => setAnalysisScope(key)}
                >
                  {label}
                </button>
              ))}
              <span className="time-scope-when">{scopeWhen}</span>
            </div>
            <KindTotals summary={scoped} />
            {scoped.byPile?.length ? (
              <>
                <div className="top-level form-label time-table-title">By pile</div>
                <SubjectTable rows={scoped.byPile} pileLink />
              </>
            ) : null}
            {scoped.byWork?.length ? (
              <>
                <div className="top-level form-label time-table-title">By work</div>
                <SubjectTable rows={scoped.byWork} workLink />
              </>
            ) : null}
            {scoped.byTitle?.length ? (
              <>
                <div className="top-level form-label time-table-title">By title</div>
                <SubjectTable rows={scoped.byTitle} />
              </>
            ) : null}
            {scoped.byDay?.length ? (
              <>
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
                    {scoped.byDay.map((d: any) => (
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
              </>
            ) : null}
            {!scoped.entryCount ? <div className="sidebar-muted">Nothing logged in this range.</div> : null}
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
                <label className="top-level form-label" htmlFor="time-work">Work</label>
                <div>
                  {workId ? (
                    <div className="time-pile-pick compact">
                      <Link to={'/work/' + workId}>
                        <em>{workName}</em>
                      </Link>
                      <button
                        className="button compact"
                        onClick={() => {
                          setWorkId(null)
                          setWorkName('')
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        id="time-work"
                        className="top-level input compact"
                        placeholder="Link a work (optional)"
                        value={workQuery}
                        onChange={(e) => setWorkQuery(e.target.value)}
                      />
                      {workResults.length > 0 || workQuery.trim().length >= 2 ? (
                        <ul className="time-pile-results">
                          {workResults.map((w: any) => (
                            <li key={w._id}>
                              <button className="button compact" onClick={() => pickWork(w._id, w.name)}>
                                <em>{w.name}</em>
                              </button>
                            </li>
                          ))}
                          {workQuery.trim() ? (
                            <li>
                              <button className="button compact" onClick={createWork}>
                                New work: {workQuery.trim()}
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
