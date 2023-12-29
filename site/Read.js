import { Link, useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import React from 'react'
import { useState, useEffect } from 'react'
import * as constants from './constants'
import ImageUploader from './ImageUploader'
import NoteList from './NoteList'
import WorkCitationSpan from './WorkCitationSpan'

function Read(props) {
  const { id } = useParams()
  const [workTitle, setWorkTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorId, setAuthorId] = useState(null)
  const [nick, setNick] = useState()
  const navigate = useNavigate()

  const fetchWorkInfo = (workId) => {
    db.getInfo(db.types.work, workId)
      .then((response) => {
        setWorkTitle(response.data.data.name)
        setAuthorName(response.data.data.author?.name)
        setAuthorId(response.data.data.author?._id)
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
      <div className={'work-page work-header'}>
        <center>
          <big>READING</big>
        </center>
      </div>
      <div className={'work-page work-header'}>
        <center>
          <WorkCitationSpan
            authorName={authorName}
            authorID={authorId}
            workTitle={workTitle}
            workID={id}
            spaceAfter={false}
          />
          <br />
          <code style={{ color: 'grey' }}> {nick}</code>
        </center>
      </div>
      <div className={'work-page work-header'}>
        <button
          className="top-level standard-button left-right"
          onClick={createNoteForWork}
          style={{ userSelect: 'none' }}
        >
          Add Note
        </button>
        <ImageUploader onImageUpload={createNoteWithImageForWork} />
      </div>
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
