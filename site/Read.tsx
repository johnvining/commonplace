import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import { useState, useEffect } from 'react'
import YearUrlComboSpan from './YearUrlComboSpan'
import * as constants from './constants'
import ImageUploader from './ImageUploader'
import NoteList from './NoteList'
import WorkCitationSpan from './WorkCitationSpan'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelTitle, TopLevelTitleContainer } from './TopLevelHeadings'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'

function Read(props: any) {
  const { id = '' } = useParams()
  const [workTitle, setWorkTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorId, setAuthorId] = useState<any>(null)
  const [nick, setNick] = useState<any>()
  const [url, setUrl] = useState('')
  const [year, setYear] = useState('')
  const navigate = useNavigate()

  const fetchWorkInfo = (workId: any) => {
    Promise.all([
      db.getInfo(db.types.work, workId),
      db.getWorkNick(workId),
    ]).then(([infoResponse, nickResponse]) => {
      const work = infoResponse.data.data
      setWorkTitle(work.name)
      setAuthorName(work.author?.name)
      setAuthorId(work.author?._id)
      setUrl(work.url)
      setYear(work.year)
      setNick(nickResponse.data.data.key)
    }).catch((error: any) => {
      console.error(error)
    })
  }

  useEffect(() => {
    fetchWorkInfo(id)
  }, [id])

  const getListOfNotes = async () => {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.work, id)
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  const createNoteWithImageForWork = async (image: any) => {
    let now = new Date()
    let title =
      'Quick Photo Note — ' +
      now.toDateString() +
      ' ' +
      now.toLocaleTimeString('en-US')
    const response = await db.createNewNoteWithImageForWork(id, image, title)

    // TODO: Janky
    window.location.reload()
  }

  const createNoteForWork = async () => {
    try {
      const response = await db.createNewNoteForWork(id)
      const noteId = response?.data?._id
      if (!noteId) {
        console.error('Create note response missing id', response)
        return
      }
      navigate('/note/' + noteId + '/edit')
    } catch (error: any) {
      console.error('Error creating note', error)
    }
  }

  // Section 3.1 & 3.3: Read page keyboard shortcuts
  // Read page is a simplified view, so only Ctrl+N (new note) is needed
  useEntityKeyboardShortcuts({
    isEditing: false,
    onNewNote: createNoteForWork,
  })

  props.setPageTitle(workTitle)

  return (
    <>
      <TopLevelTitleContainer>
        <TopLevelTitle>
          <WorkCitationSpan
            authorName={authorName}
            authorID={authorId}
            workTitle={workTitle}
            workID={id}
            spaceAfter={year || url}
          />
          <YearUrlComboSpan year={year} url={url} />
        </TopLevelTitle>
      </TopLevelTitleContainer>
      <TopLevelStandardButtonContainer nick={nick}>
        <TopLevelStandardButton name="Add Note" onClick={createNoteForWork} />
        <ImageUploader
          onImageUpload={createNoteWithImageForWork}
          buttonClassName="button left-right"
        />
      </TopLevelStandardButtonContainer>
      <NoteList
        key={'work' + id}
        viewMode={constants.view_modes.RESULT}
        getListOfNotes={getListOfNotes}
        reverse={true}
      />
    </>
  )
}

export default Read
