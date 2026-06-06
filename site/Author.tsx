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
import { saveAndExitEdit } from './saveAndExitEdit'

function Author(props: any) {
  const { id = '' } = useParams()
  const [edit, setEdit] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [pendingBirthYear, setPendingBirthYear] = useState('')
  const [pendingDeathYear, setPendingDeathYear] = useState('')
  const [pendingUsernames, setPendingUsernames] = useState('')
  const [works, setWorks] = useState<any>(null)
  const [authorOnlyNotes, setAuthorOnlyNotes] = useState<any[]>([])
  const navigate = useNavigate()

  const fetchAuthorInfo = (id: any) => {
    db.getInfo(db.types.auth, id)
      .then((response: any) => {
        setPendingName(response.data.data.name)
        setPendingBirthYear(response.data.data.birth_year)
        setPendingDeathYear(response.data.data.death_year)
        setPendingUsernames((response.data.data.usernames ?? []).join(', '))
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
    db.getRecordsWithFilter(db.types.note, db.types.auth, id)
      .then((response: any) => {
        if (cancelled) return
        const allNotes: any[] = response?.data?.data ?? []
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

  const handleAcceptUpdates = async () => {
    var updateObject = {
      name: pendingName,
      birth_year: pendingBirthYear,
      death_year: pendingDeathYear,
      usernames: pendingUsernames.split(',').map(u => u.trim()).filter(Boolean),
    }

    await saveAndExitEdit(
      () => db.updateRecord(db.types.auth, id, updateObject),
      setEdit
    )
  }

  useEntityKeyboardShortcuts({
    isEditing: edit,
    onEdit: () => setEdit(true),
    onSave: handleAcceptUpdates,
    onExitEdit: () => setEdit(false),
    onToggleStar: () => id && togglePinned({ type: 'auth', id, label: pendingName, href: `/auth/${id}` }),
  })

  const deleteAuthor = async () => {
    if (!confirm(`Do you want to permanently delete '${pendingName}'?`)) {
      return
    }

    await db.deleteRecord(db.types.auth, id)
    navigate('/')
  }

  props.setPageTitle(pendingName)
  return (
    <div>
      {/* Header and Edit */}
      <div key="author-information">
        {edit ? (
          <TopLevelFormContainer>
            <TopLevelFormInput
              id="name"
              name="Name"
              defaultValue={pendingName}
              onChange={(e: any) => {
                setPendingName(e.target.value)
              }}
            />
            <TopLevelFormInput
              id="birth-year"
              name="Birth Year"
              defaultValue={pendingBirthYear}
              onChange={(e: any) => {
                setPendingBirthYear(e.target.value)
              }}
            />
            <TopLevelFormInput
              id="death-year"
              name="Death Year"
              defaultValue={pendingDeathYear}
              onChange={(e: any) => {
                setPendingDeathYear(e.target.value)
              }}
            />
            <TopLevelFormInput
              id="usernames"
              name="Usernames"
              defaultValue={pendingUsernames}
              onChange={(e: any) => {
                setPendingUsernames(e.target.value)
              }}
            />
            <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
          </TopLevelFormContainer>
        ) : (
          <div className="entity-page-header">
            <div className="entity-page-header-left">
              <div className="entity-page-title">{pendingName}</div>
              {(pendingBirthYear || pendingDeathYear) && (
                <div className="entity-page-byline">
                  {pendingBirthYear ? (
                    <>b. <YearSpan year={pendingBirthYear} /></>
                  ) : null}
                  {pendingBirthYear && pendingDeathYear ? ' • ' : null}
                  {pendingDeathYear ? (
                    <>d. <YearSpan year={pendingDeathYear} /></>
                  ) : null}
                </div>
              )}
              {pendingUsernames ? (
                <div className="entity-page-byline-secondary">
                  {pendingUsernames.split(',').map(u => u.trim()).filter(Boolean).map(u => `@${u}`).join(', ')}
                </div>
              ) : null}
            </div>
            <div className="entity-page-header-right">
              <TopLevelStandardButtonContainer className="top-level-toolbar">
                <TopLevelStarButton
                  type="auth"
                  id={id}
                  label={pendingName}
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
    </div>
  )
}

export default Author
