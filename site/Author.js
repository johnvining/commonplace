import { useNavigate, useParams } from 'react-router-dom'
import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import ResultWork from './ResultWork'
import YearSpan from './YearSpan'
import { useState, useEffect } from 'react'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormInput, TopLevelFormContainer } from './TopLevelFormItems'

function Author(props) {
  const { id } = useParams()
  const [edit, setEdit] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [pendingBirthYear, setPendingBirthYear] = useState('')
  const [pendingDeathYear, setPendingDeathYear] = useState('')
  const [works, setWorks] = useState(null)
  const navigate = useNavigate()

  const fetchAuthorInfo = (id) => {
    db.getInfo(db.types.auth, id)
      .then((response) => {
        setPendingName(response.data.data.name)
        setPendingBirthYear(response.data.data.birth_year)
        setPendingDeathYear(response.data.data.death_year)
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

  const getListOfNotes = async (index, page) => {
    var notesResponse
    if (index == undefined) {
      await db
        .getRecordsWithFilter(db.types.note, db.types.auth, id)
        .then((response) => {
          notesResponse = response
        })
        .catch((error) => {
          console.error(error)
        })
    } else {
      var workId = works[index]?._id
      await db
        .getRecordsWithFilter(db.types.note, db.types.work, workId)
        .then((response) => {
          notesResponse = response
        })
        .catch((error) => {
          console.error(error)
        })
    }

    return notesResponse
  }

  const deleteAuthor = async () => {
    if (!confirm(`Do you want to permanently delete '${pendingName}'?`)) {
      return
    }

    await db.deleteRecord(db.types.auth, id)
    navigate('/')
  }

  const handleAcceptUpdates = async () => {
    var updateObject = {
      name: pendingName,
      birth_year: pendingBirthYear,
      death_year: pendingDeathYear,
    }

    db.updateRecord(db.types.auth, id, updateObject)
    setEdit(false)
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
            <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
          </TopLevelFormContainer>
        ) : (
          <>
            <div className="page-title">{pendingName}</div>
            {pendingBirthYear || pendingDeathYear ? (
              <div className="page-sub-title">
                {pendingBirthYear ? (
                  <>
                    {'b. '} <YearSpan year={pendingBirthYear} />
                  </>
                ) : null}
                {pendingDeathYear ? (
                  <>
                    {' d. '} <YearSpan year={pendingDeathYear} />
                  </>
                ) : null}
              </div>
            ) : null}

            <TopLevelStandardButtonContainer>
              <TopLevelStandardButton name="Delete" onClick={deleteAuthor} />
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

      {/* Work List */}
      {works?.map((work, workindex) => (
        <div key={'work-listing-' + workindex}>
          <ResultWork work={work} key={'work-' + work._id} />
          <div className="result-box parent">
            <NoteList
              key={'notes-for-work' + work._id}
              index={workindex}
              viewMode={constants.view_modes.RESULT}
              getListOfNotes={getListOfNotes}
            />
          </div>
        </div>
      ))}
      <NoteList
        key={'auth' + id}
        viewMode={constants.view_modes.RESULT}
        useGroupings={true}
        getListOfNotes={getListOfNotes}
      />
    </div>
  )
}

export default Author
