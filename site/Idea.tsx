import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import NoteList from './NoteList'
import YearSpan from './YearSpan'
import { useState, useEffect } from 'react'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormContainer, TopLevelFormInput } from './TopLevelFormItems'
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'
import { TopLevelStarButton } from './PinButton'
import { togglePinned } from './pinned'

function Idea(props: any) {
  const { id = '' } = useParams()
  const [edit, setEdit] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [pendingStartYear, setPendingStartYear] = useState('')
  const [pendingEndYear, setPendingEndYear] = useState('')
  const [nick, setNick] = useState('')
  const navigate = useNavigate()

  const fetchIdeaInfo = (ideaId: any) => {
    Promise.all([
      db.getInfo(db.types.idea, ideaId),
      db.getIdeaNick(ideaId),
    ]).then(([infoResponse, nickResponse]) => {
      const idea = infoResponse.data.data
      setPendingName(idea.name)
      setPendingStartYear(idea.start_year)
      setPendingEndYear(idea.end_year)
      setNick(nickResponse.data.data.key)
    }).catch((error: any) => {
      console.error(error)
    })
  }

  useEffect(() => {
    fetchIdeaInfo(id)
  }, [id])

  const getListOfNotes = async () => {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.idea, id)
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  const deleteIdea = async () => {
    if (!confirm(`Do you want to permanently delete '${pendingName}'?`)) {
      return
    }

    await db.deleteRecord(db.types.idea, id)
    navigate('/')
  }

  const handleAcceptUpdates = async () => {
    var updateObject = {
      name: pendingName,
      start_year: pendingStartYear,
      end_year: pendingEndYear,
    }

    db.updateRecord(db.types.idea, id, updateObject)
    setEdit(false)
  }

  const createNoteForIdea = async () => {
    try {
      const response = await db.createNewNoteFromTitle('')
      const noteId = response?.data?._id
      if (!noteId) {
        console.error('Create note response missing id', response)
        return
      }
      // Add the idea to the new note
      await db.addLinkToRecord(db.types.idea, id, db.types.note, noteId)
      navigate('/note/' + noteId + '/edit')
    } catch (error: any) {
      console.error('Error creating note for idea', error)
    }
  }

  const toggleStar = () => {
    if (!id) return
    togglePinned({
      type: 'idea',
      id,
      label: pendingName,
      href: `/idea/${id}`,
    })
  }

  // Section 3.1 & 3.5: Idea page keyboard shortcuts
  useEntityKeyboardShortcuts({
    isEditing: edit,
    onEdit: () => setEdit(true),
    onSave: handleAcceptUpdates,
    onExitEdit: () => setEdit(false),
    onNewNote: createNoteForIdea,
    onToggleStar: toggleStar,
  })

  props.setPageTitle(pendingName)

  return (
    <div>
      <div key="idea-information">
        {edit ? (
          <TopLevelFormContainer>
            <TopLevelFormInput
              name="Name"
              id="title"
              defaultValue={pendingName}
              onChange={(e: any) => {
                setPendingName(e.target.value)
              }}
            />
            <TopLevelFormInput
              name="Start Year"
              id="startYear"
              defaultValue={pendingStartYear}
              onChange={(e: any) => {
                setPendingStartYear(e.target.value)
              }}
            />
            <TopLevelFormInput
              name="End Year"
              id="endYear"
              defaultValue={pendingEndYear}
              onChange={(e: any) => {
                setPendingEndYear(e.target.value)
              }}
            />
            <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
          </TopLevelFormContainer>
        ) : (
          <>
            <TopLevelTitleContainer>
              <TopLevelTitle>{pendingName}</TopLevelTitle>
              {pendingStartYear || pendingEndYear ? (
                <TopLevelSubTitle>
                  {pendingStartYear ? (
                    <YearSpan year={pendingStartYear} />
                  ) : null}
                  {pendingStartYear && pendingEndYear ? ' • ' : null}
                  {pendingEndYear ? <YearSpan year={pendingEndYear} /> : null}
                </TopLevelSubTitle>
              ) : null}
            </TopLevelTitleContainer>
            <TopLevelStandardButtonContainer
              nick={nick}
              className="top-level-toolbar"
            >
              <TopLevelStarButton
                type="idea"
                id={id}
                label={pendingName}
                href={`/idea/${id}`}
              />
              <TopLevelStandardButton name="Delete" onClick={deleteIdea} />
              <TopLevelStandardButton
                name="Edit"
                onClick={() => {
                  setEdit(true)
                }}
              />
            </TopLevelStandardButtonContainer>
          </>
        )}
      </div>

      <NoteList
        key={'idea' + id}
        viewMode={props.viewMode}
        getListOfNotes={getListOfNotes}
      />
    </div>
  )
}

export default Idea
