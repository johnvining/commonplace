import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import ResultWork from './ResultWork'
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

function Author(props: any) {
  const { id } = useParams()
  const [edit, setEdit] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [pendingBirthYear, setPendingBirthYear] = useState('')
  const [pendingDeathYear, setPendingDeathYear] = useState('')
  const [pendingUsernames, setPendingUsernames] = useState('')
  const [works, setWorks] = useState<any>(null)
  const navigate = useNavigate()

  const fetchAuthorInfo = (id) => {
    db.getInfo(db.types.auth, id)
      .then((response) => {
        setPendingName(response.data.data.name)
        setPendingBirthYear(response.data.data.birth_year)
        setPendingDeathYear(response.data.data.death_year)
        setPendingUsernames((response.data.data.usernames ?? []).join(', '))
      })
      .catch((error) => {
        console.error(error)
      })
  }

  const fetchAuthorWorks = (id) => {
    db.getRecordsWithFilter(db.types.work, db.types.auth, id)
      .then((response) => {
        setWorks(response.data.data)
      })
      .catch((error) => {
        console.error(error)
      })
  }

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

    db.updateRecord(db.types.auth, id, updateObject)
    setEdit(false)
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
              onChange={(e) => {
                setPendingName(e.target.value)
              }}
            />
            <TopLevelFormInput
              id="birth-year"
              name="Birth Year"
              defaultValue={pendingBirthYear}
              onChange={(e) => {
                setPendingBirthYear(e.target.value)
              }}
            />
            <TopLevelFormInput
              id="death-year"
              name="Death Year"
              defaultValue={pendingDeathYear}
              onChange={(e) => {
                setPendingDeathYear(e.target.value)
              }}
            />
            <TopLevelFormInput
              id="usernames"
              name="Usernames"
              defaultValue={pendingUsernames}
              onChange={(e) => {
                setPendingUsernames(e.target.value)
              }}
            />
            <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
          </TopLevelFormContainer>
        ) : (
          <>
            <TopLevelTitleContainer>
              <TopLevelTitle>{pendingName}</TopLevelTitle>
              {pendingBirthYear || pendingDeathYear ? (
                <TopLevelSubTitle>
                  {pendingBirthYear ? (
                    <>
                      b. <YearSpan year={pendingBirthYear} />
                    </>
                  ) : null}
                  {pendingBirthYear && pendingDeathYear ? ' • ' : null}
                  {pendingDeathYear ? (
                    <>
                      d. <YearSpan year={pendingDeathYear} />
                    </>
                  ) : null}
                </TopLevelSubTitle>
              ) : null}
              {pendingUsernames ? (
                <TopLevelSubTitle>
                  {pendingUsernames.split(',').map(u => u.trim()).filter(Boolean).map(u => `@${u}`).join(', ')}
                </TopLevelSubTitle>
              ) : null}
            </TopLevelTitleContainer>
            <TopLevelStandardButtonContainer className="top-level-toolbar">
              <TopLevelStarButton
                type="auth"
                id={id}
                label={pendingName}
                href={`/auth/${id}`}
              />
              <TopLevelStandardButton name="Delete" onClick={deleteAuthor} />
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
            </TopLevelStandardButtonContainer>
          </>
        )}
      </div>

      {/* Work List */}
      {works?.map((work, workindex) => (
        <div key={'work-listing-' + workindex}>
          <ResultWork work={work} key={'work-' + work._id} />
        </div>
      ))}
    </div>
  )
}

export default Author
