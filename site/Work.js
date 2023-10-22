import { Link, useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import NoteList from './NoteList'
import PileListForItem from './PileListForItem'
import YearSpan from './YearSpan'
import React from 'react'
import { useState, useEffect } from 'react'
import * as constants from './constants'
import autosize from 'autosize'

function Work(props) {
  const { id } = useParams()
  const [edit, setEdit] = useState(false)
  const [importMode, setImportMode] = useState(false)
  const [pendingImportText, setPendingImportText] = useState('')
  const [editPiles, setEditPiles] = useState(false)
  // TODO: Create pending object
  const [pendingWorkTitle, setPendingWorkTitle] = useState('')
  const [pendingUrl, setPendingUrl] = useState('')
  const [pendingYear, setPendingYear] = useState('')
  const [pendingAuthorName, setPendingAuthorName] = useState('')
  const [pendingAuthorId, setPendingAuthorId] = useState('')
  const [pendingSummary, setPendingSummary] = useState('')
  const [pendingCitationInfo, setPendingCitationInfo] = useState('')
  const [piles, setPiles] = useState()
  const [nick, setNick] = useState()
  const navigate = useNavigate()

  const fetchWorkInfo = (workId) => {
    db.getInfo(db.types.work, workId)
      .then((response) => {
        setPendingWorkTitle(response.data.data.name)
        setPiles(response.data.data.piles)
        setPendingAuthorName(response.data.data.author?.name)
        setPendingAuthorId(response.data.data.author?._id)
        setPendingUrl(response.data.data.url)
        setPendingYear(response.data.data.year)
        setPendingSummary(response.data.data.summary)
        setPendingCitationInfo(response.data.data.citation_information)
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
      } else if (event.keyCode == constants.keyCodes.esc) {
        // TODO: This crashes because of a failure in NoteList
        handleFinishEditing()
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

  const handleUpdateAuthor = (authorId, authorName) => {
    setPendingAuthorName(authorName)
    setPendingAuthorId(authorId)
  }

  const handleCreateAuthorAndAssign = (authorName) => {
    setPendingAuthorName(authorName)
    db.createAndLinkToRecord(db.types.auth, authorName, db.types.work, id).then(
      (response) => {
        setPendingAuthorId(response.data.data.id)
      }
    )
  }

  const deleteWork = async () => {
    if (!confirm(`Do you want to permanently delete '${pendingWorkTitle}'?`)) {
      return
    }

    await db.deleteRecord(db.types.work, id)
    navigate('/')
  }

  const handleAcceptUpdates = async () => {
    var updateObject = {
      author: pendingAuthorId,
      year: pendingYear,
      url: pendingUrl,
      name: pendingWorkTitle,
      summary: pendingSummary,
      citation_information: pendingCitationInfo,
    }

    db.updateRecord(db.types.work, id, updateObject)
    setEdit(false)
  }

  const handleImport = async () => {
    let importText = pendingImportText
    setPendingImportText('')
    db.importNotesForWork(importText, id).then(() => {
      fetchWorkInfo(id)
      setImportMode(false)
    })
  }

  const handleNewPile = async (pile) => {
    db.addLinkToRecord(db.types.pile, pile, db.types.work, id).then(() => {
      fetchWorkInfo(id)
    })
  }

  const handleCreatePileAndAssign = (pileName) => {
    db.createAndLinkToRecord(db.types.pile, pileName, db.types.work, id).then(
      () => {
        fetchWorkInfo(id)
      }
    )
  }

  const handleClearAuthor = async () => {
    setPendingAuthorId(null)
    setPendingAuthorName('')
  }

  const handleFinishEditing = async () => {
    setEdit(false)
    setEditPiles(false)
  }

  const handlePileRemove = async (pileId) => {
    db.removeFromRecord(db.types.pile, pileId, db.types.work, id).then(() => {
      fetchWorkInfo(id)
    })
  }

  const createNoteForWork = async () => {
    const response = await db.createNewNoteForWork(id)
    navigate('/note/' + response.data._id + '/edit')
  }

  props.setPageTitle(pendingWorkTitle)

  return (
    <>
      {/* Piles */}
      <div>
        <PileListForItem
          remove={edit}
          edit={false}
          piles={piles}
          onSelect={handleNewPile}
          getSuggestions={db.getSuggestions}
          handleNewSelect={handleCreatePileAndAssign}
          mainClassName="work-page"
          onStartPileEdit={() => {
            setEditPiles(true)
          }}
          allowAdd={true}
          allowTabbing={true}
          onPileRemove={handlePileRemove}
        />
      </div>
      {/* Main Content */}
      {edit ? (
        <>
          <label htmlFor="title" className="work-page form-label">
            Title
          </label>
          <input
            className="work-page title input"
            id="title"
            defaultValue={pendingWorkTitle}
            onChange={(e) => {
              setPendingWorkTitle(e.target.value)
            }}
          />
          <label htmlFor="citation-info" className="work-page form-label">
            Citation Information
          </label>
          <input
            defaultValue={pendingCitationInfo}
            id="citation-info"
            className="work-page citation-info input"
            onChange={(e) => {
              setPendingCitationInfo(e.target.value)
            }}
          />
          <label htmlFor="work-author" className="work-page form-label">
            Author
          </label>
          <Autocomplete
            inputName="work-author"
            className={'work-page author-select'}
            dontAutofocus={true}
            defaultValue={pendingAuthorName || ''}
            onSelect={handleUpdateAuthor}
            getSuggestions={db.getSuggestions}
            apiType={db.types.auth}
            handleNewSelect={handleCreateAuthorAndAssign}
            onClearText={handleClearAuthor}
          />

          <label htmlFor="url" className="work-page form-label">
            URL
          </label>
          <input
            defaultValue={pendingUrl}
            id="url"
            className="work-page url input"
            onChange={(e) => {
              setPendingUrl(e.target.value)
            }}
          />
          <label htmlFor="year" className="work-page form-label">
            Year
          </label>
          <input
            defaultValue={pendingYear}
            className="work-page year input"
            onChange={(e) => {
              setPendingYear(e.target.value)
            }}
          />
          <label htmlFor="url" className="work-page form-label">
            Summary
          </label>
          <textarea
            defaultValue={pendingSummary}
            id="summary"
            className="work-page summary input"
            onChange={(e) => {
              setPendingSummary(e.target.value)
              autosize(document.querySelector('#summary'))
            }}
          />
        </>
      ) : (
        <>
          {pendingAuthorName && (
            <div className={'work-page author'}>
              <Link to={'/auth/' + pendingAuthorId}>{pendingAuthorName}</Link>
            </div>
          )}
          {pendingWorkTitle && (
            <>
              <span className="work-page title">{pendingWorkTitle}</span>
            </>
          )}
          {(pendingCitationInfo || pendingYear || pendingUrl) && (
            <>
              <br />{' '}
              <span className="work-page">
                {pendingCitationInfo && pendingCitationInfo + ' '}
                {pendingYear && <YearSpan year={pendingYear} />}
                {pendingUrl && <a href={pendingUrl}> link</a>}
              </span>
            </>
          )}

          {pendingSummary && (
            <>
              <br /> <span className="work-page">{pendingSummary}</span>
            </>
          )}
        </>
      )}
      {/* Buttons */}
      <div>
        {edit ? (
          <button
            className="top-level standard-button left-right"
            onClick={handleAcceptUpdates}
          >
            Done
          </button>
        ) : editPiles ? (
          <>
            <button
              className="top-level standard-button left-right"
              onClick={handleFinishEditing}
            >
              Done
            </button>
            <Autocomplete
              inputName="work-work-pile"
              className={'work-page pile-select'}
              dontAutofocus={false}
              defaultValue={''}
              onSelect={handleNewPile}
              getSuggestions={db.getSuggestions}
              apiType={db.types.pile}
              handleNewSelect={handleCreatePileAndAssign}
              clearOnSelect={true}
              excludeIds={piles?.map((pile) => pile._id)}
            />
          </>
        ) : (
          <>
            <button
              className="top-level standard-button left-right"
              onClick={() => {
                setEdit(true)
                setEditPiles(false)
              }}
            >
              Edit
            </button>
            <button
              className="top-level standard-button left-right"
              onClick={() => {
                setEdit(false)
                setEditPiles(true)
              }}
            >
              Piles
            </button>
            <button
              className="top-level standard-button left-right"
              onClick={deleteWork}
            >
              Delete
            </button>
            <button
              className="top-level standard-button left-right"
              onClick={() => {
                setImportMode(!importMode)
              }}
            >
              Import
            </button>
            <button
              className="top-level standard-button left-right"
              onClick={createNoteForWork}
              style={{ userSelect: 'none' }}
            >
              + Note
            </button>
            <div style={{ display: 'inline', marginLeft: '10px' }}>
              <code style={{ color: 'grey' }}>
                <small>{nick}</small>
              </code>
            </div>
          </>
        )}
      </div>
      {importMode ? (
        <div className="full-width">
          <div name="text" className="width-100">
            <textarea
              id="importText"
              className={'work-page importText input'}
              value={pendingImportText}
              onChange={(e) => {
                setPendingImportText(e.target.value)
                autosize(document.querySelector('#importText'))
              }}
            ></textarea>
          </div>
          <button
            className="top-level standard-button left-right"
            onClick={handleImport}
          >
            Done
          </button>
        </div>
      ) : (
        <NoteList
          key={'work' + id}
          viewMode={props.viewMode}
          getListOfNotes={getListOfNotes}
        />
      )}
    </>
  )
}

export default Work
