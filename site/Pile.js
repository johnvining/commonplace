import { useNavigate, useParams } from 'react-router-dom'
import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import WorkList from './WorkList'
import YearSpan from './YearSpan'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import TopLevelStandardButton from './TopLevelStandardButton'

function Pile(props) {
  const { id } = useParams()
  const [edit, setEdit] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [pendingStartYear, setPendingStartYear] = useState('')
  const [pendingEndYear, setPendingEndYear] = useState('')
  const [nick, setNick] = useState('')
  const navigate = useNavigate()

  const fetchPileInfo = (pileId) => {
    db.getInfo(db.types.pile, pileId)
      .then((response) => {
        setPendingName(response.data.data.name)
        setPendingStartYear(response.data.data.start_year)
        setPendingEndYear(response.data.data.end_year)
      })
      .catch((error) => {
        console.error(error)
      })
    db.getPileNick(pileId).then((response) => {
      setNick(response.data.data.key)
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
      .then((response) => {
        notesResponse = response
      })
      .catch((error) => {
        console.error(error)
      })

    return notesResponse
  }

  const getListOfWorks = async () => {
    var worksResponse
    await db
      .getRecordsWithFilter(db.types.work, db.types.pile, id)
      .then((response) => {
        worksResponse = response
      })
      .catch((error) => {
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

    db.updateRecord(db.types.pile, id, updateObject)
    setEdit(false)
  }

  props.setPageTitle(pendingName)
  return (
    <div>
      {/* Header and Edit */}
      <div key="pile-information">
        {edit ? (
          <>
            <label htmlFor="title" className="work-page form-label">
              Name
            </label>
            <input
              className="work-page title input"
              id="title"
              defaultValue={pendingName}
              onChange={(e) => {
                setPendingName(e.target.value)
              }}
            />
            <label htmlFor="startYear" className="work-page form-label">
              Start Year
            </label>
            <input
              className="work-page title input"
              id="startYear"
              defaultValue={pendingStartYear}
              onChange={(e) => {
                setPendingStartYear(e.target.value)
              }}
            />
            <label htmlFor="endYear" className="work-page form-label">
              End Year
            </label>
            <input
              className="work-page title input"
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
              <div style={{ display: 'inline', marginLeft: '10px' }}>
                <code style={{ color: 'grey' }}>
                  <small>{nick}</small>
                </code>
              </div>
            </div>
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
