import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
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
  const navigate = useNavigate()

  const fetchAuthorInfo = (id: any) => {
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
        console.error(error)
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
  })

  const deleteAuthor = async () => {
    if (!confirm(`Do you want to permanently delete '${pending.name}'?`)) {
      return
    }

    await db.deleteRecord(db.types.auth, id)
    navigate('/')
  }

  props.setPageTitle(pending.name)
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
            <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
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
                  onClick={() => {
                    setEdit(true)
                  }}
                />
                <TopLevelStandardButton
                  name="Show Notes"
                  onClick={() => navigate(`/auth/${id}/notes`)}
                />
                <TopLevelStandardButton name="Delete" onClick={deleteAuthor} />
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
