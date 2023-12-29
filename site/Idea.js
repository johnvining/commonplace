import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import YearSpan from './YearSpan'
import { useState, useEffect } from 'react'
import TopLevelStandardButton from './TopLevelStandardButton'
import { TopLevelFormInput } from './TopLevelFormItems'

function Idea(props) {
  const { id } = useParams()
  const [edit, setEdit] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [pendingStartYear, setPendingStartYear] = useState('')
  const [pendingEndYear, setPendingEndYear] = useState('')
  const [nick, setNick] = useState('')
  const navigate = useNavigate()

  const fetchIdeaInfo = (ideaId) => {
    db.getInfo(db.types.idea, ideaId)
      .then((response) => {
        setPendingName(response.data.data.name)
        setPendingStartYear(response.data.data.start_year)
        setPendingEndYear(response.data.data.end_year)
      })
      .catch((error) => {
        console.error(error)
      })
    db.getIdeaNick(ideaId).then((response) => {
      setNick(response.data.data.key)
    })
  }

  useEffect(() => {
    fetchIdeaInfo(id)
  }, [id])

  const getListOfNotes = async () => {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.idea, id)
      .then((response) => {
        notesResponse = response
      })
      .catch((error) => {
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

  props.setPageTitle(pendingName)

  return (
    <div>
      <div key="idea-information">
        {edit ? (
          <>
            <TopLevelFormInput
              name="Name"
              id="title"
              defaultValue={pendingName}
              onChange={(e) => {
                setPendingName(e.target.value)
              }}
            />
            <TopLevelFormInput
              name="Start Year"
              id="startYear"
              defaultValue={pendingStartYear}
              onChange={(e) => {
                setPendingStartYear(e.target.value)
              }}
            />
            <TopLevelFormInput
              name="End Year"
              id="endYear"
              defaultValue={pendingEndYear}
              onChange={(e) => {
                setPendingEndYear(e.target.value)
              }}
            />
            <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
          </>
        ) : (
          <>
            <div className="page-title">{pendingName}</div>
            {pendingStartYear || pendingEndYear ? (
              <div className="page-sub-title">
                {pendingStartYear ? <YearSpan year={pendingStartYear} /> : null}
                {pendingStartYear && pendingEndYear ? ' to ' : null}
                {pendingEndYear ? <YearSpan year={pendingEndYear} /> : null}
              </div>
            ) : null}
            <div>
              <TopLevelStandardButton name="Delete" onClick={deleteIdea} />
              <TopLevelStandardButton
                name="Edit"
                onClick={() => {
                  setEdit(true)
                }}
              />
              <div style={{ display: 'inline', marginLeft: '10px' }}>
                <code style={{ color: 'grey' }}>
                  <small>{nick}</small>
                </code>
              </div>
            </div>
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
