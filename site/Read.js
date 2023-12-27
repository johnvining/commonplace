import { Link, useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import React from 'react'
import { useState, useEffect } from 'react'
import * as constants from './constants'

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

  const createNoteForWork = async () => {
    const response = await db.createNewNoteForWork(id)
    navigate('/note/' + response.data._id + '/edit')
  }

  props.setPageTitle(workTitle)

  return (
    <>
      <div className={'work-page work-header'}>
        {authorName && (
          <span className={'work-page author'}>
            <Link to={'/auth/' + authorId}>{authorName}</Link>
          </span>
        )}
        {workTitle && authorName && (
          <span className={'work-page author'}>, </span>
        )}
        {workTitle && (
          <>
            <span className="work-page title">{workTitle}</span>
          </>
        )}
      </div>
      <div>
        <button
          className="top-level standard-button left-right"
          onClick={createNoteForWork}
          style={{ userSelect: 'none' }}
        >
          + Note
        </button>
        <button
          className="top-level standard-button left-right"
          onClick={createNoteForWork}
          style={{ userSelect: 'none' }}
        >
          + Photo Note
        </button>
        <div style={{ display: 'inline', marginLeft: '10px' }}>
          <code style={{ color: 'grey' }}>
            <small>{nick}</small>
          </code>
        </div>
      </div>
    </>
  )
}

export default Read
