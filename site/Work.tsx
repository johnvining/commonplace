import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import NoteList from './NoteList'
import PileListForItem from './PileListForItem'
import YearUrlComboSpan from './YearUrlComboSpan'
import { useState, useEffect, useCallback } from 'react'
import autosize from 'autosize'
import WorkCitationSpan from './WorkCitationSpan'
import { renderMarkdown } from './safeMarkdown'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'
import ImageUploader from './ImageUploader'
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
import { TopLevelStarButton } from './PinButton'
import { togglePinned } from './pinned'

function Work(props: any) {
  const { id = '' } = useParams()
  const [edit, setEdit] = useState(false)
  const [importMode, setImportMode] = useState(false)
  const [pendingImportText, setPendingImportText] = useState('')
  const [editPiles, setEditPiles] = useState(false)
  // TODO: Create pending object
  const [pendingWorkTitle, setPendingWorkTitle] = useState('')
  const [pendingUrl, setPendingUrl] = useState('')
  const [pendingYear, setPendingYear] = useState('')
  const [pendingAuthorName, setPendingAuthorName] = useState('')
  const [pendingAuthorId, setPendingAuthorId] = useState<string | null>('')
  const [pendingSummary, setPendingSummary] = useState('')
  const [pendingCitationInfo, setPendingCitationInfo] = useState('')
  const [piles, setPiles] = useState<any[]>([])
  const [nick, setNick] = useState<any>()
  const [notesRefreshKey, setNotesRefreshKey] = useState(0)
  const navigate = useNavigate()

  // Function to handle nick navigation
  const handleNickClick = useCallback(
    async (nickValue: any, e: any) => {
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
      } catch (error: any) {
        console.error('Error fetching nick:', error)
      }
    },
    [navigate],
  )

  // Function to process HTML string and convert nicks to links (including in code blocks)
  const processHtmlForNicks = (html: any) => {
    if (!html) return html
    // Match nick patterns: letter (n, w, i, p) followed by digits
    const nickPattern = /\b([nwip]\d+)\b/g

    // Process the HTML string, replacing nicks with anchor tags
    // We need to handle both regular text and text inside code/pre tags
    return html.replace(nickPattern, (match: any) => {
      // Create an anchor tag with a special data attribute
      return `<a href="#" data-nick="${match}" class="nick-link">${match}</a>`
    })
  }

  const fetchWorkInfo = (workId: any) => {
    Promise.all([
      db.getInfo(db.types.work, workId),
      db.getWorkNick(workId),
    ]).then(([infoResponse, nickResponse]) => {
      const work = infoResponse.data.data
      setPendingWorkTitle(work.name)
      setPiles(work.piles)
      setPendingAuthorName(work.author?.name)
      setPendingAuthorId(work.author?._id)
      setPendingUrl(work.url)
      setPendingYear(work.year)
      setPendingSummary(work.summary)
      setPendingCitationInfo(work.citation_information)
      setNick(nickResponse.data.data.key)
    }).catch((error: any) => {
      console.error(error)
    })
  }

  useEffect(() => {
    fetchWorkInfo(id)
  }, [id])

  // Handle click events on nick links using event delegation
  useEffect(() => {
    const handleNickLinkClick = (e: any) => {
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
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  const handleUpdateAuthor = (authorId: any, authorName: any) => {
    setPendingAuthorName(authorName)
    setPendingAuthorId(authorId)
  }

  const handleCreateAuthorAndAssign = (authorName: any) => {
    setPendingAuthorName(authorName)
    db.createAndLinkToRecord(db.types.auth, authorName, db.types.work, id).then(
      (response: any) => {
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

    try {
      await db.updateRecord(db.types.work, id, updateObject)
      setEdit(false)
    } catch {
      // Toast surfaced by axios interceptor; stay in edit mode for retry.
    }
  }

  const handleImport = async () => {
    let importText = pendingImportText
    setPendingImportText('')
    db.importNotesForWork(importText, id).then(() => {
      fetchWorkInfo(id)
      setImportMode(false)
    })
  }

  const handleNewPile = async (pile: any) => {
    db.addLinkToRecord(db.types.pile, pile, db.types.work, id).then(() => {
      fetchWorkInfo(id)
    })
  }

  const handleCreatePileAndAssign = (pileName: any) => {
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

  const handlePileRemove = async (pileId: any) => {
    db.removeFromRecord(db.types.pile, pileId, db.types.work, id).then(() => {
      fetchWorkInfo(id)
    })
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

  const createNotesForWorkFromImages = async (images: any, onProgress: any) => {
    if (!images?.length) {
      return
    }

    let completed = 0
    for (const image of images) {
      try {
        const response = await db.createNewNoteForWork(id)
        const noteId = response?.data?._id
        if (!noteId) {
          console.error('Create note response missing id', response)
          completed += 1
          if (onProgress) onProgress(completed, images.length)
          continue
        }
        await db.addImageToNote(noteId, image)
        await db.getNoteTextOCR(noteId)
        completed += 1
        if (onProgress) onProgress(completed, images.length)
      } catch (error: any) {
        console.error('Error creating note from image', error)
        completed += 1
        if (onProgress) onProgress(completed, images.length)
      }
    }

    setNotesRefreshKey((prev: any) => prev + 1)
  }

  const toggleStar = () => {
    if (!id) return
    togglePinned({
      type: 'work',
      id,
      label: pendingWorkTitle,
      href: `/work/${id}`,
    })
  }

  // Section 3.1 & 3.2: Work page keyboard shortcuts
  useEntityKeyboardShortcuts({
    isEditing: edit || editPiles,
    onEdit: () => {
      setEdit(true)
      setEditPiles(false)
    },
    onSave: handleAcceptUpdates,
    onExitEdit: handleFinishEditing,
    onNewNote: createNoteForWork,
    onEditPiles: () => {
      setEdit(false)
      setEditPiles(true)
    },
    onToggleStar: toggleStar,
  })

  props.setPageTitle(pendingWorkTitle)

  return (
    <>
      {edit ? (
        <TopLevelFormContainer>
          <TopLevelFormInput
            name="Title"
            id="title"
            defaultValue={pendingWorkTitle}
            onChange={(e: any) => {
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
            onChange={(e: any) => {
              setPendingCitationInfo(e.target.value)
            }}
          />
          {/* TODO: Create a mode for smaller input */}
          <TopLevelFormInput
            name="URL"
            id="url"
            defaultValue={pendingUrl}
            onChange={(e: any) => {
              setPendingUrl(e.target.value)
            }}
          />
          <TopLevelFormInput
            name="Year"
            id="year"
            defaultValue={pendingYear}
            onChange={(e: any) => {
              setPendingYear(e.target.value)
            }}
          />
          <TopLevelFormTextArea
            name="Summary"
            id="summary"
            value={pendingSummary}
            onChange={(e: any) => {
              setPendingSummary(e.target.value)
              autosize(document.querySelector('#summary') as HTMLElement)
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
        <div style={{ marginBottom: '4px' }}>
          <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
        </div>
      ) : editPiles ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
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
              excludeIds={piles?.map((pile: any) => pile._id)}
            />
          </TopLevelStandardButtonContainer>
          <div style={{ textAlign: 'right', maxWidth: '50%', flexShrink: 1 }}>
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0px',
          }}
        >
          <TopLevelStandardButtonContainer
            nick={nick}
            className="top-level-toolbar"
          >
            <TopLevelStarButton
              type="work"
              id={id}
              label={pendingWorkTitle}
              href={`/work/${id}`}
            />
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
            <TopLevelStandardButton
              name="Add Note"
              onClick={createNoteForWork}
            />
            <ImageUploader
              onImagesUpload={createNotesForWorkFromImages}
              allowMultiple={true}
              buttonClassName="button left-right"
            />
          </TopLevelStandardButtonContainer>
          <div style={{ textAlign: 'right', maxWidth: '50%', flexShrink: 1 }}>
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
              __html: processHtmlForNicks(renderMarkdown(pendingSummary)),
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
            onChange={(e: any) => {
              setPendingImportText(e.target.value)
              autosize(document.querySelector('#import-text') as HTMLElement)
            }}
          />
          <TopLevelStandardButtonContainer>
            <TopLevelStandardButton name="Done" onClick={handleImport} />
          </TopLevelStandardButtonContainer>
        </TopLevelFormContainer>
      ) : (
        <NoteList
          key={`work-${id}-${notesRefreshKey}`}
          viewMode={props.viewMode}
          getListOfNotes={getListOfNotes}
        />
      )}
    </>
  )
}

export default Work
