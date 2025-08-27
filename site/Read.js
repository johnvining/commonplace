import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import React from 'react'
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

function Read(props) {
  const { id } = useParams()
  const [workTitle, setWorkTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorId, setAuthorId] = useState(null)
  const [nick, setNick] = useState()
  const [url, setUrl] = useState('')
  const [year, setYear] = useState('')
  const navigate = useNavigate()

  const fetchWorkInfo = (workId) => {
    db.getInfo(db.types.work, workId)
      .then((response) => {
        setWorkTitle(response.data.data.name)
        setAuthorName(response.data.data.author?.name)
        setAuthorId(response.data.data.author?._id)
        setUrl(response.data.data.url)
        setYear(response.data.data.year)
      })
      .catch((error) => {
        console.error(error)
      })
    db.getWorkNick(workId).then((response) => {
      setNick(response.data.data.key)
    })
  }

  useEffect(() => {
    fetchWorkInfo(id)
  }, [id])

  useEffect(() => {
    const onKeyDown = async (event) => {
      if (event.ctrlKey && event.keyCode == constants.keyCodes.new) {
        createNoteForWork()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  const getListOfNotes = async () => {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.work, id)
      .then((response) => {
        notesResponse = response
      })
      .catch((error) => {
        console.error(error)
      })

    return notesResponse
  }

  const createNoteWithImageForWork = async (image) => {
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
    const response = await db.createNewNoteForWork(id)
    navigate('/note/' + response.data._id + '/edit')
  }

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
        <ImageUploader onImageUpload={createNoteWithImageForWork} />
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
