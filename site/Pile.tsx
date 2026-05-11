import { useNavigate, useParams } from 'react-router-dom'
import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import WorkList from './WorkList'
import YearSpan from './YearSpan'
import { useState, useEffect } from 'react'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'
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
import { togglePinned } from './pinned'

function Pile(props: any) {
  const { id = '' } = useParams()
  const [edit, setEdit] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [pendingStartYear, setPendingStartYear] = useState('')
  const [pendingEndYear, setPendingEndYear] = useState('')
  const [nick, setNick] = useState('')
  const navigate = useNavigate()

  const fetchPileInfo = (pileId: any) => {
    Promise.all([
      db.getInfo(db.types.pile, pileId),
      db.getPileNick(pileId),
    ]).then(([infoResponse, nickResponse]) => {
      const pile = infoResponse.data.data
      setPendingName(pile.name)
      setPendingStartYear(pile.start_year)
      setPendingEndYear(pile.end_year)
      setNick(nickResponse.data.data.key)
    }).catch((error: any) => {
      console.error(error)
    })
  }

  useEffect(() => {
    fetchPileInfo(id)
  }, [id])

  const handleDeletePile = async () => {
    if (!confirm(`Do you want to permanently delete '${pendingName}'?`)) {
      return
    }

    await db.deleteRecord(db.types.pile, id)
    navigate('/')
  }

  const getListOfNotes = async () => {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.pile, id)
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  const getListOfWorks = async () => {
    var worksResponse
    await db
      .getRecordsWithFilter(db.types.work, db.types.pile, id)
      .then((response: any) => {
        worksResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return worksResponse
  }

  const handleAcceptUpdates = async () => {
    var updateObject = {
      name: pendingName,
      start_year: pendingStartYear,
      end_year: pendingEndYear,
    }

    try {
      await db.updateRecord(db.types.pile, id, updateObject)
      setEdit(false)
    } catch {
      // Toast surfaced by axios interceptor; stay in edit mode for retry.
    }
  }

  const createNoteForPile = async () => {
    try {
      const response = await db.createNewNoteFromTitle('')
      const noteId = response?.data?._id
      if (!noteId) {
        console.error('Create note response missing id', response)
        return
      }
      // Add the pile to the new note
      await db.addLinkToRecord(db.types.pile, id, db.types.note, noteId)
      navigate('/note/' + noteId + '/edit')
    } catch (error: any) {
      console.error('Error creating note for pile', error)
    }
  }

  const toggleStar = () => {
    if (!id) return
    togglePinned({
      type: 'pile',
      id,
      label: pendingName,
      href: `/pile/${id}`,
    })
  }

  // Section 3.1 & 3.4: Pile page keyboard shortcuts
  useEntityKeyboardShortcuts({
    isEditing: edit,
    onEdit: () => setEdit(true),
    onSave: handleAcceptUpdates,
    onExitEdit: () => setEdit(false),
    onNewNote: createNoteForPile,
    onToggleStar: toggleStar,
  })

  props.setPageTitle(pendingName)
  return (
    <div>
      {/* Header and Edit */}
      <div key="pile-information">
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
                type="pile"
                id={id}
                label={pendingName}
                href={`/pile/${id}`}
              />
              <TopLevelStandardButton
                name="Delete"
                onClick={handleDeletePile}
              />
              <TopLevelStandardButton
                name="Edit"
                onClick={() => {
                  setEdit(true)
                }}
              />
              {!props.showNotes ? (
                <TopLevelStandardButton
                  name="View notes"
                  onClick={() => {
                    navigate('/pile/' + id + '/notes')
                  }}
                />
              ) : (
                <TopLevelStandardButton
                  name="View all"
                  onClick={() => {
                    navigate('/pile/' + id)
                  }}
                />
              )}
            </TopLevelStandardButtonContainer>
          </>
        )}
      </div>

      {/* Note and Work List */}
      {props.showNotes ? (
        <NoteList
          key={'noteList' + id}
          viewMode={props.viewMode}
          getListOfNotes={getListOfNotes}
        />
      ) : (
        <>
          <WorkList key={'workList' + id} getListOfWorks={getListOfWorks} />
          <NoteList
            key={'noteList' + id}
            viewMode={constants.view_modes.RESULT}
            getListOfNotes={getListOfNotes}
          />
        </>
      )}
    </div>
  )
}

export default Pile
