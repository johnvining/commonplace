import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import Missing, { isNotFound, whatBecameOf } from './Missing'
import ClickToCopyNick from './ClickToCopyNick'
import { titleWithNick } from './utils'
import ResultWork from './ResultWork'
import NoteResult from './NoteResult'
import YearSpan from './YearSpan'
import { useState, useEffect } from 'react'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormInput, TopLevelFormContainer } from './TopLevelFormItems'
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'
import { TopLevelStarButton } from './PinButton'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'
import { togglePinned } from './pinned'
import { useEntityEditor } from './useEntityEditor'

function Author(props: any) {
  const { id = '' } = useParams()
  const editor = useEntityEditor(db.types.auth, id, {
    name: '',
    birth_year: '' as number | string,
    death_year: '' as number | string,
    // Edited as "a, b"; sent as a list.
    usernames: '',
  })
  const { editing: edit, setEditing: setEdit, values: pending } = editor
  const [works, setWorks] = useState<any>(null)
  const [authorOnlyNotes, setAuthorOnlyNotes] = useState<any[]>([])
  // Notes the server holds beyond the first page fetched below; when
  // non-zero the list here is incomplete and we link to the paged view.
  const [unfetchedNoteCount, setUnfetchedNoteCount] = useState(0)
  // Notes about this person, as opposed to by them (#246).
  const [notesAbout, setNotesAbout] = useState<any[]>([])
  const [notesAboutTotal, setNotesAboutTotal] = useState(0)
  // Works they edited or translated, listed apart from their own (#358).
  const [credits, setCredits] = useState<{ edited: any[]; translated: any[] }>({ edited: [], translated: [] })
  // Set when the author doesn't exist (#386)
  const [missing, setMissing] = useState<{ name?: string | null } | null>(null)
  const [nick, setNick] = useState('')
  const navigate = useNavigate()

  const fetchAuthorInfo = (id: any) => {
    setMissing(null)
    setNick('')
    // Its nick, made now if it predates author nicks (#382)
    db.getAuthNick(id).then((r: any) => setNick(r?.data?.data?.key ?? '')).catch(() => {})
    db.getInfo(db.types.auth, id)
      .then((response: any) => {
        const author = response.data.data
        editor.load({
          name: author.name,
          birth_year: author.birth_year ?? '',
          death_year: author.death_year ?? '',
          usernames: (author.usernames ?? []).join(', '),
        })
      })
      .catch((error: any) => {
        if (!isNotFound(error)) return console.error(error)
        // Gone: follow a merge to the kept author, else say so (#386)
        whatBecameOf('auth', id).then(({ forwardTo, name }) => {
          if (forwardTo) navigate('/auth/' + forwardTo, { replace: true })
          else setMissing({ name })
        })
      })
  }

  const fetchAuthorWorks = (id: any) => {
    db.getRecordsWithFilter(db.types.work, db.types.auth, id)
      .then((response: any) => {
        setWorks(response.data.data)
      })
      .catch((error: any) => {
        console.error(error)
      })
  }

  // Notes attributed to this author directly. We exclude notes whose work
  // already appears in the works section above, so we don't double-list
  // (those notes are accessible by clicking through to the work).
  useEffect(() => {
    if (works === null) return
    let cancelled = false
    db.getNotesPageForEntity(db.types.auth, id)
      .then((response: any) => {
        if (cancelled) return
        const allNotes: any[] = response?.data?.data ?? []
        const total = db.notePageTotal(response)
        setUnfetchedNoteCount(total === null ? 0 : Math.max(0, total - allNotes.length))
        const workIds = new Set((works ?? []).map((w: any) => String(w._id)))
        const filtered = allNotes.filter((n: any) => {
          const wid = n.work?._id ? String(n.work._id) : null
          return !wid || !workIds.has(wid)
        })
        setAuthorOnlyNotes(filtered)
      })
      .catch((err: any) => console.error(err))
    return () => { cancelled = true }
  }, [id, works])

  useEffect(() => {
    fetchAuthorInfo(id)
    fetchAuthorWorks(id)
  }, [id])

  useEffect(() => {
    let cancelled = false
    db.getAuthorCredits(id)
      .then((response: any) => {
        if (cancelled) return
        const data = response?.data?.data
        setCredits({ edited: data?.edited ?? [], translated: data?.translated ?? [] })
      })
      .catch((err: any) => console.error(err))
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    let cancelled = false
    db.getNotesAboutAuthor(id)
      .then((response: any) => {
        if (cancelled) return
        const notes = response?.data?.data ?? []
        setNotesAbout(notes)
        setNotesAboutTotal(db.notePageTotal(response) ?? notes.length)
      })
      .catch((err: any) => console.error(err))
    return () => { cancelled = true }
  }, [id])

  const handleAcceptUpdates = () =>
    editor.save((v) => ({
      ...v,
      usernames: v.usernames.split(',').map((u) => u.trim()).filter(Boolean),
    }))

  useEntityKeyboardShortcuts({
    isEditing: edit,
    onEdit: () => setEdit(true),
    onSave: handleAcceptUpdates,
    onExitEdit: editor.cancel,
    onToggleStar: () => id && togglePinned({ type: 'auth', id, label: pending.name, href: `/auth/${id}` }),
    onDelete: () => deleteAuthor(),
    onViewNotes: () => navigate(`/auth/${id}/notes`),
  })

  const deleteAuthor = async () => {
    if (!confirm(`Do you want to permanently delete '${pending.name}'?`)) {
      return
    }

    await db.deleteRecord(db.types.auth, id)
    navigate('/')
  }

  if (missing) {
    props.setPageTitle('Author does not exist')
    return <Missing type="author" name={missing.name} />
  }

  props.setPageTitle(titleWithNick(pending.name, nick))
  return (
    <div>
      {/* Header and Edit */}
      <div key="author-information">
        {edit ? (
          <TopLevelFormContainer>
            <TopLevelFormInput
              id="name"
              name="Name"
              autoFocus
              defaultValue={pending.name}
              onChange={(e: any) => {
                editor.set('name', e.target.value)
              }}
            />
            <TopLevelFormInput
              id="birth-year"
              name="Birth Year"
              defaultValue={pending.birth_year}
              onChange={(e: any) => {
                editor.set('birth_year', e.target.value)
              }}
            />
            <TopLevelFormInput
              id="death-year"
              name="Death Year"
              defaultValue={pending.death_year}
              onChange={(e: any) => {
                editor.set('death_year', e.target.value)
              }}
            />
            <TopLevelFormInput
              id="usernames"
              name="Usernames"
              defaultValue={pending.usernames}
              onChange={(e: any) => {
                editor.set('usernames', e.target.value)
              }}
            />
            <TopLevelStandardButtonContainer>
              <TopLevelStandardButton name="Done" shortcut="Ctrl+A" position="left" onClick={handleAcceptUpdates} />
              <TopLevelStandardButton name="Cancel" shortcut="Esc" position="right" onClick={editor.cancel} />
            </TopLevelStandardButtonContainer>
          </TopLevelFormContainer>
        ) : (
          <div className="entity-page-header">
            <div className="entity-page-header-left">
              <div className="entity-page-title">{pending.name}</div>
              {(pending.birth_year || pending.death_year) && (
                <div className="entity-page-byline">
                  {pending.birth_year ? (
                    <>b. <YearSpan year={pending.birth_year} /></>
                  ) : null}
                  {pending.birth_year && pending.death_year ? ' • ' : null}
                  {pending.death_year ? (
                    <>d. <YearSpan year={pending.death_year} /></>
                  ) : null}
                </div>
              )}
              {pending.usernames ? (
                <div className="entity-page-byline-secondary">
                  {pending.usernames.split(',').map(u => u.trim()).filter(Boolean).map(u => `@${u}`).join(', ')}
                </div>
              ) : null}
              {nick && (
                <div className="entity-page-nick">
                  <ClickToCopyNick nick={nick} />
                </div>
              )}
            </div>
            <div className="entity-page-header-right">
              <TopLevelStandardButtonContainer className="top-level-toolbar">
                <TopLevelStarButton
                  type="auth"
                  id={id}
                  label={pending.name}
                  href={`/auth/${id}`}
                />
                <TopLevelStandardButton
                  name="Edit"
                  shortcut="Ctrl+E"
                  onClick={() => {
                    setEdit(true)
                  }}
                />
                <TopLevelStandardButton
                  name="Show Notes"
                  shortcut="v"
                  onClick={() => navigate(`/auth/${id}/notes`)}
                />
                <TopLevelStandardButton name="Delete" shortcut="#" onClick={deleteAuthor} />
              </TopLevelStandardButtonContainer>
            </div>
          </div>
        )}
      </div>

      {/* Work List */}
      {works?.map((work: any, workindex: any) => (
        <div key={'work-listing-' + workindex}>
          <ResultWork work={work} key={'work-' + work._id} />
        </div>
      ))}

      {credits.edited.length > 0 ? (
        <>
          <div className="entity-page-section-heading">Edited</div>
          {credits.edited.map((work: any) => (
            <ResultWork work={work} key={'edited-' + work._id} />
          ))}
        </>
      ) : null}
      {credits.translated.length > 0 ? (
        <>
          <div className="entity-page-section-heading">Translated</div>
          {credits.translated.map((work: any) => (
            <ResultWork work={work} key={'translated-' + work._id} />
          ))}
        </>
      ) : null}

      {/* Notes attributed to this author (excluding those from works above) */}
      {authorOnlyNotes.map((note: any) => (
        <NoteResult note={note} key={'auth-note-' + note._id} />
      ))}
      {notesAbout.length > 0 ? (
        <>
          <div className="entity-page-section-heading">
            Notes about {pending.name}
            {notesAboutTotal > notesAbout.length
              ? ` (showing ${notesAbout.length.toLocaleString()} of ${notesAboutTotal.toLocaleString()})`
              : ''}
          </div>
          {notesAbout.map((note: any) => (
            <NoteResult note={note} key={'about-note-' + note._id} />
          ))}
        </>
      ) : null}
      {unfetchedNoteCount > 0 ? (
        <div className="search-empty-state">
          {unfetchedNoteCount.toLocaleString()} more notes not shown.{' '}
          <a
            href={`/auth/${id}/notes`}
            onClick={e => {
              e.preventDefault()
              navigate(`/auth/${id}/notes`)
            }}
          >
            See all notes
          </a>
        </div>
      ) : null}
    </div>
  )
}

export default Author
