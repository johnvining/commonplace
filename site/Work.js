import { Link, useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import NoteList from './NoteList'
import PileListForItem from './PileListForItem'
import YearUrlComboSpan from './YearUrlComboSpan'
import React from 'react'
import { useState, useEffect, useCallback } from 'react'
import * as constants from './constants'
import autosize from 'autosize'
import WorkCitationSpan from './WorkCitationSpan'
import { marked } from 'marked'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import {
  TopLevelFormAutocomplete,
  TopLevelFormInput,
  TopLevelFormTextArea,
  TopLevelFormContainer,
} from './TopLevelFormItems'
import {
  TopLevelTitleContainer,
  TopLevelTitle,
  TopLevelPostButtonContent,
} from './TopLevelHeadings'

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

  // Function to handle nick navigation
  const handleNickClick = useCallback(
    async (nickValue, e) => {
      e.preventDefault()
      try {
        const nickResponse = await db.getNick(nickValue)
        if (nickResponse?.data?.data) {
          const nickData = nickResponse.data.data
          switch (nickData.key?.charAt(0)) {
            case 'n':
              navigate('/note/' + nickData.note)
              break
            case 'w':
              navigate('/work/' + nickData.work)
              break
            case 'i':
              navigate('/idea/' + nickData.idea)
              break
            case 'p':
              navigate('/pile/' + nickData.pile)
              break
            default:
              break
          }
        }
      } catch (error) {
        console.error('Error fetching nick:', error)
      }
    },
    [navigate],
  )

  // Function to process HTML string and convert nicks to links (including in code blocks)
  const processHtmlForNicks = (html) => {
    if (!html) return html
    // Match nick patterns: letter (n, w, i, p) followed by digits
    const nickPattern = /\b([nwip]\d+)\b/g

    // Process the HTML string, replacing nicks with anchor tags
    // We need to handle both regular text and text inside code/pre tags
    return html.replace(nickPattern, (match) => {
      // Create an anchor tag with a special data attribute
      return `<a href="#" data-nick="${match}" class="nick-link">${match}</a>`
    })
  }

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

  // Handle click events on nick links using event delegation
  useEffect(() => {
    const handleNickLinkClick = (e) => {
      const target = e.target.closest('.nick-link')
      if (target && target.dataset.nick) {
        e.preventDefault()
        handleNickClick(target.dataset.nick, e)
      }
    }

    // Use event delegation on the document, but check for nick-link class
    document.addEventListener('click', handleNickLinkClick)
    return () => {
      document.removeEventListener('click', handleNickLinkClick)
    }
  }, [handleNickClick])

  useEffect(() => {
    const onKeyDown = async (event) => {
      if (event.keyCode == constants.keyCodes.esc) {
        // TODO: This crashes because of a failure in NoteList
        handleFinishEditing()
        return
      }

      if (!event.ctrlKey) {
        return
      }

      switch (event.keyCode) {
        case constants.keyCodes.new:
          createNoteForWork()
          return
        case constants.keyCodes.accept:
          edit && handleAcceptUpdates()
          return
        case constants.keyCodes.piles:
          setEdit(false)
          setEditPiles(true)
          return
        case constants.keyCodes.edit:
          setEdit(true)
          setEditPiles(false)
          return
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  useEffect(() => {
    if (edit) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        const summaryElement = document.querySelector('#summary')
        if (summaryElement) {
          autosize(summaryElement)
        }
      }, 0)
    }
  }, [edit, pendingSummary])

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
      },
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
      },
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
      {edit ? (
        <TopLevelFormContainer>
          <TopLevelFormInput
            name="Title"
            id="title"
            defaultValue={pendingWorkTitle}
            onChange={(e) => {
              setPendingWorkTitle(e.target.value)
            }}
          />
          <TopLevelFormAutocomplete
            name="Author"
            id="author"
            ontAutofocus={true}
            defaultValue={pendingAuthorName || ''}
            onSelect={handleUpdateAuthor}
            getSuggestions={db.getSuggestions}
            apiType={db.types.auth}
            handleNewSelect={handleCreateAuthorAndAssign}
            onClearText={handleClearAuthor}
          />
          <TopLevelFormInput
            name="Citation Information"
            id="citation-info"
            defaultValue={pendingCitationInfo}
            onChange={(e) => {
              setPendingCitationInfo(e.target.value)
            }}
          />
          {/* TODO: Create a mode for smaller input */}
          <TopLevelFormInput
            name="URL"
            id="url"
            defaultValue={pendingUrl}
            onChange={(e) => {
              setPendingUrl(e.target.value)
            }}
          />
          <TopLevelFormInput
            name="Year"
            id="year"
            defaultValue={pendingYear}
            onChange={(e) => {
              setPendingYear(e.target.value)
            }}
          />
          <TopLevelFormTextArea
            name="Summary"
            id="summary"
            value={pendingSummary}
            onChange={(e) => {
              setPendingSummary(e.target.value)
              autosize(document.querySelector('#summary'))
            }}
          />
        </TopLevelFormContainer>
      ) : (
        <TopLevelTitleContainer>
          <TopLevelTitle>
            <WorkCitationSpan
              authorName={pendingAuthorName}
              authorID={pendingAuthorId}
              workTitle={pendingWorkTitle}
              workID={null}
              spaceAfter={pendingYear || pendingUrl}
            />
            <YearUrlComboSpan year={pendingYear} url={pendingUrl} />
          </TopLevelTitle>
        </TopLevelTitleContainer>
      )}
      {edit ? (
        <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
      ) : editPiles ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <TopLevelStandardButtonContainer>
            <TopLevelStandardButton name="Done" onClick={handleFinishEditing} />
            {/* TODO: Create Standard Button inline autocomplete with better margin/padding */}
            <Autocomplete
              inputName="work-work-pile"
              className={'top-level pile-select'}
              dontAutofocus={false}
              defaultValue={''}
              onSelect={handleNewPile}
              getSuggestions={db.getSuggestions}
              apiType={db.types.pile}
              handleNewSelect={handleCreatePileAndAssign}
              clearOnSelect={true}
              excludeIds={piles?.map((pile) => pile._id)}
            />
          </TopLevelStandardButtonContainer>
          <div style={{ textAlign: 'right', maxWidth: '50%', flexShrink: 1, alignSelf: 'center' }}>
            <PileListForItem
              remove={editPiles}
              edit={false}
              piles={piles}
              onSelect={handleNewPile}
              getSuggestions={db.getSuggestions}
              handleNewSelect={handleCreatePileAndAssign}
              mainClassName="top-level"
              onStartPileEdit={() => {
                setEditPiles(true)
              }}
              allowAdd={false}
              allowTabbing={true}
              onPileRemove={handlePileRemove}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <TopLevelStandardButtonContainer nick={nick}>
            <TopLevelStandardButton
              name="Edit"
              onClick={() => {
                setEdit(true)
                setEditPiles(false)
              }}
            />
            <TopLevelStandardButton
              name="Piles"
              onClick={() => {
                setEdit(false)
                setEditPiles(true)
              }}
            />
            <TopLevelStandardButton name="Delete" onClick={deleteWork} />
            <TopLevelStandardButton
              name="Import"
              onClick={() => {
                setImportMode(!importMode)
              }}
            />
            <TopLevelStandardButton
              name="Read"
              onClick={() => {
                navigate('/read/' + id)
              }}
            />
            <TopLevelStandardButton name="Add Note" onClick={createNoteForWork} />
          </TopLevelStandardButtonContainer>
          <div style={{ textAlign: 'right', maxWidth: '50%', flexShrink: 1, alignSelf: 'center' }}>
            <PileListForItem
              remove={editPiles}
              edit={false}
              piles={piles}
              onSelect={handleNewPile}
              getSuggestions={db.getSuggestions}
              handleNewSelect={handleCreatePileAndAssign}
              mainClassName="top-level"
              onStartPileEdit={() => {
                setEditPiles(true)
              }}
              allowAdd={false}
              allowTabbing={true}
              onPileRemove={handlePileRemove}
            />
          </div>
        </div>
      )}
      {!edit && (pendingCitationInfo || pendingSummary) ? (
        <TopLevelPostButtonContent>
          {pendingCitationInfo}
          {pendingCitationInfo && pendingSummary && <br />}
          {pendingCitationInfo && pendingSummary && <br />}
          <div
            className="work-summary"
            dangerouslySetInnerHTML={{
              __html: processHtmlForNicks(marked(pendingSummary || '')),
            }}
          />
        </TopLevelPostButtonContent>
      ) : null}
      {importMode ? (
        <TopLevelFormContainer>
          <TopLevelFormTextArea
            name="Import Notes"
            id="import-text"
            value={pendingImportText}
            onChange={(e) => {
              setPendingImportText(e.target.value)
              autosize(document.querySelector('#import-text'))
            }}
          />
          <TopLevelStandardButtonContainer>
            <TopLevelStandardButton name="Done" onClick={handleImport} />
          </TopLevelStandardButtonContainer>
        </TopLevelFormContainer>
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
