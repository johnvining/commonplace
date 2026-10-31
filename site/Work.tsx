import { Link, useNavigate, useParams } from 'react-router-dom'
import { useKeyboardShortcuts } from './KeyboardContext'
import * as db from './Database'
import { titleWithNick } from './utils'
import * as constants from './constants'
import Autocomplete from './Autocomplete'
import NoteList from './NoteList'
import PileListForItem from './PileListForItem'
import YearUrlComboSpan from './YearUrlComboSpan'
import { useState, useEffect } from 'react'
import autosize from 'autosize'
import WorkCitationSpan from './WorkCitationSpan'
import { renderMarkdown } from './safeMarkdown'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'
import { useEntityEditor } from './useEntityEditor'
import AuthorsChipList from './AuthorsChipList'
import PilesPillList from './PilesPillList'
import IdeasPillList from './IdeasPillList'
import ClickToCopyNick from './ClickToCopyNick'
import ImageUploader from './ImageUploader'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import {
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
  const [importMode, setImportMode] = useState(false)
  const [pendingImportText, setPendingImportText] = useState('')
  const [editPiles, setEditPiles] = useState(false)
  const [editIdeas, setEditIdeas] = useState(false)
  // TODO: Create pending object
  const editor = useEntityEditor(db.types.work, id, {
    name: '',
    original_name: '',
    url: '',
    year: '' as number | string,
    // Edited as author records; sent as ids.
    authors: [] as import('./authorsDisplay').AuthorLike[],
    summary: '',
    citation_information: '',
  })
  const { editing: edit, setEditing: setEdit, values: pending } = editor
  const [piles, setPiles] = useState<any[]>([])
  const [ideas, setIdeas] = useState<any[]>([])
  const [nick, setNick] = useState<any>()
  const [notesRefreshKey, setNotesRefreshKey] = useState(0)
  const navigate = useNavigate()

  // Function to handle nick navigation

  // Function to process HTML string and convert nicks to links (including in code blocks)
  const processHtmlForNicks = (html: any) => {
    if (!html) return html
    // Match nick patterns: letter (n, w, i, p) followed by digits
    const nickPattern = /\b([nwip]\d+)\b/g

    // Process the HTML string, replacing nicks with anchor tags
    // We need to handle both regular text and text inside code/pre tags
    return html.replace(nickPattern, (match: any) => {
      // Create an anchor tag with a special data attribute
      return `<a href="/${match}" data-nick="${match}" class="nick-link">${match}</a>`
    })
  }

  const fetchWorkInfo = (workId: any) => {
    Promise.all([
      db.getInfo(db.types.work, workId),
      db.getWorkNick(workId),
    ]).then(([infoResponse, nickResponse]) => {
      const work = infoResponse.data.data
      editor.load({
        name: work.name,
        original_name: work.original_name ?? '',
        url: work.url ?? '',
        year: work.year ?? '',
        authors: Array.isArray(work.authors) ? work.authors : [],
        summary: work.summary ?? '',
        citation_information: work.citation_information ?? '',
      })
      setPiles(work.piles)
      setIdeas(work.ideas ?? [])
      setNick(nickResponse.data.data.key)
    }).catch((error: any) => {
      console.error(error)
    })
  }

  useEffect(() => {
    fetchWorkInfo(id)
  }, [id])

  useEffect(() => {
    if (id) db.recordOpened(db.types.work, id)
  }, [id])

  // Nick links in the summary are real links to /<nick>, which NickView
  // resolves. A plain click navigates in-app at once (modified clicks open
  // a tab), and hovering starts the lookup so it's usually done by then.
  useEffect(() => {
    const nickOf = (e: any) => e.target?.closest?.('.nick-link')?.dataset?.nick
    const handleNickLinkClick = (e: any) => {
      const nick = nickOf(e)
      if (!nick || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      navigate('/' + nick)
    }
    const prefetchNick = (e: any) => {
      const nick = nickOf(e)
      if (nick) db.getNick(nick).catch(() => {})
    }
    document.addEventListener('click', handleNickLinkClick)
    document.addEventListener('mouseover', prefetchNick)
    return () => {
      document.removeEventListener('click', handleNickLinkClick)
      document.removeEventListener('mouseover', prefetchNick)
    }
  }, [navigate])

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
  }, [edit, pending.summary])

  const getListOfNotes = async (_index: any, page: number) => {
    var notesResponse
    await db
      .getNotesPageForEntity(db.types.work, id, page)
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  const deleteWork = async () => {
    if (!confirm(`Do you want to permanently delete '${pending.name}'?`)) {
      return
    }

    await db.deleteRecord(db.types.work, id)
    navigate('/')
  }

  const handleAcceptUpdates = () =>
    editor.save((v) => ({ ...v, authors: v.authors.map((a) => a._id).filter(Boolean) }))

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

  // Leaves any edit mode; an unsaved edit of the work's fields is dropped.
  const handleFinishEditing = async () => {
    editor.cancel()
    setEditPiles(false)
    setEditIdeas(false)
  }

  const handleNewIdea = (ideaId: any) => {
    db.addLinkToRecord(db.types.idea, ideaId, db.types.work, id).then(() => {
      fetchWorkInfo(id)
    })
  }

  const handleCreateIdeaAndAssign = (ideaName: any) => {
    db.createAndLinkToRecord(db.types.idea, ideaName, db.types.work, id).then(
      () => {
        fetchWorkInfo(id)
      },
    )
  }

  const handleIdeaRemove = (ideaId: any) => {
    db.removeFromRecord(db.types.idea, ideaId, db.types.work, id).then(() => {
      fetchWorkInfo(id)
    })
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
        // The upload reads the image into the note's text (auto OCR).
        await db.addImageToNote(noteId, image)
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
      label: pending.name,
      href: `/work/${id}`,
    })
  }

  // Section 3.1 & 3.2: Work page keyboard shortcuts
  useEntityKeyboardShortcuts({
    isEditing: edit || editPiles || editIdeas,
    onEdit: () => {
      setEdit(true)
      setEditPiles(false)
      setEditIdeas(false)
    },
    onSave: handleAcceptUpdates,
    onExitEdit: handleFinishEditing,
    onNewNote: createNoteForWork,
    onEditPiles: () => {
      setEdit(false)
      setEditIdeas(false)
      setEditPiles(true)
    },
    onToggleStar: toggleStar,
    onEditIdeas: () => {
      setEdit(false)
      setEditPiles(false)
      setEditIdeas(true)
    },
    onDelete: deleteWork,
    onRead: () => navigate('/read/' + id),
    onImport: () => setImportMode(!importMode),
    onUploadImages: () =>
      (document.querySelector('.top-level-toolbar input[type=file]') as HTMLInputElement | null)?.click(),
  })

  // Ctrl+Enter finishes an import, even while typing in its text box.
  useKeyboardShortcuts(constants.keyboardScopes.ENTITY_EDIT, (event: any) => {
    if (!importMode || !(event.ctrlKey && event.keyCode === constants.keyCodes.enter)) return false
    handleImport()
    return true
  })

  props.setPageTitle(titleWithNick(pending.name, nick))

  return (
    <>
      {edit ? (
        <TopLevelFormContainer>
          <TopLevelFormInput
            name="Title"
            id="title"
            autoFocus
            defaultValue={pending.name}
            onChange={(e: any) => {
              editor.set('name', e.target.value)
            }}
          />
          <TopLevelFormInput
            name="Original title (if Title is a translation)"
            id="originalTitle"
            defaultValue={pending.original_name}
            onChange={(e: any) => {
              editor.set('original_name', e.target.value)
            }}
          />
          <label htmlFor="add-author" className="top-level form-label">Authors</label>
          <AuthorsChipList
            value={pending.authors}
            onChange={(authors) => editor.set('authors', authors)}
            onExit={handleFinishEditing}
            inputId="add-author"
            dontAutofocus
          />
          <TopLevelFormInput
            name="Citation Information"
            id="citation-info"
            defaultValue={pending.citation_information}
            onChange={(e: any) => {
              editor.set('citation_information', e.target.value)
            }}
          />
          {/* TODO: Create a mode for smaller input */}
          <TopLevelFormInput
            name="URL"
            id="url"
            defaultValue={pending.url}
            onChange={(e: any) => {
              editor.set('url', e.target.value)
            }}
          />
          <TopLevelFormInput
            name="Year"
            id="year"
            defaultValue={pending.year}
            onChange={(e: any) => {
              editor.set('year', e.target.value)
            }}
          />
          <TopLevelFormTextArea
            name="Summary"
            id="summary"
            value={pending.summary}
            onChange={(e: any) => {
              editor.set('summary', e.target.value)
              autosize(document.querySelector('#summary') as HTMLElement)
            }}
          />
        </TopLevelFormContainer>
      ) : (
        <>
          <div className="entity-page-header">
            <div className="entity-page-header-left">
              <div className="entity-page-title">
                <WorkCitationSpan
                  workTitle={pending.name}
                  workID={null}
                  spaceAfter={pending.year || pending.url}
                />
                <YearUrlComboSpan year={pending.year} url={pending.url} />
              </div>
              {pending.original_name && (
                <div className="entity-page-byline work-original-name">
                  {pending.original_name}
                </div>
              )}
              {pending.authors.length > 0 && (
                <div className="entity-page-byline">
                  <WorkCitationSpan authors={pending.authors} />
                </div>
              )}
              {nick && (
                <div className="entity-page-nick">
                  <ClickToCopyNick nick={nick} />
                </div>
              )}
            </div>
            <div className="entity-page-header-right">
              {editPiles ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '360px',
                    maxWidth: '100%',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <PilesPillList
                      value={piles ?? []}
                      onAddExisting={(pile) => handleNewPile(pile._id)}
                      onCreateNew={(name) => handleCreatePileAndAssign(name)}
                      onRemove={(id) => handlePileRemove(id)}
                      onExit={() => setEditPiles(false)}
                      inputId="work-work-pile"
                      compact
                    />
                  </div>
                  <TopLevelStandardButton name="Done" shortcut="Esc" onClick={handleFinishEditing} />
                </div>
              ) : editIdeas ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '360px',
                    maxWidth: '100%',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <IdeasPillList
                      value={ideas}
                      onAddExisting={(idea) => handleNewIdea(idea._id)}
                      onCreateNew={(name) => handleCreateIdeaAndAssign(name)}
                      onRemove={(ideaId) => handleIdeaRemove(ideaId)}
                      onExit={() => setEditIdeas(false)}
                      inputId="work-idea"
                    />
                  </div>
                  <TopLevelStandardButton name="Done" shortcut="Esc" onClick={handleFinishEditing} />
                </div>
              ) : (
                <>
                  <TopLevelStandardButtonContainer className="top-level-toolbar">
                    <TopLevelStarButton
                      type="work"
                      id={id}
                      label={pending.name}
                      href={`/work/${id}`}
                    />
                    <TopLevelStandardButton
                      name="Edit"
                      shortcut="Ctrl+E"
                      onClick={() => {
                        setEdit(true)
                        setEditPiles(false)
                        setEditIdeas(false)
                      }}
                    />
                    <TopLevelStandardButton
                      name="Piles"
                      shortcut="Ctrl+P"
                      onClick={() => {
                        setEdit(false)
                        setEditIdeas(false)
                        setEditPiles(true)
                      }}
                    />
                    <TopLevelStandardButton
                      name="Ideas"
                      shortcut="Ctrl+T"
                      onClick={() => {
                        setEdit(false)
                        setEditPiles(false)
                        setEditIdeas(true)
                      }}
                    />
                    <TopLevelStandardButton name="Delete" shortcut="#" onClick={deleteWork} />
                  </TopLevelStandardButtonContainer>
                  <TopLevelStandardButtonContainer className="top-level-toolbar">
                    <TopLevelStandardButton
                      name="Read"
                      shortcut="r"
                      onClick={() => {
                        navigate('/read/' + id)
                      }}
                    />
                    <TopLevelStandardButton
                      name="Add Note"
                      shortcut="Ctrl+N"
                      onClick={createNoteForWork}
                    />
                    <ImageUploader
                      onImagesUpload={createNotesForWorkFromImages}
                      allowMultiple={true}
                      buttonClassName="button left-right"
                      shortcut="Ctrl+U"
                    />
                    <TopLevelStandardButton
                      name="Import"
                      shortcut="i"
                      onClick={() => {
                        setImportMode(!importMode)
                      }}
                    />
                  </TopLevelStandardButtonContainer>
                  {piles && piles.length > 0 && (
                    <div className="entity-page-piles">
                      <PileListForItem piles={piles} allowTabbing={true} />
                    </div>
                  )}
                  {ideas.length > 0 && (
                    <div className="entity-page-piles">
                      {ideas.map((idea: any) => (
                        <Link to={'/idea/' + idea._id} key={idea._id} tabIndex={-1}>
                          <button className="idea label">{idea.name}</button>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {(pending.citation_information || pending.summary) && (
            <details className="work-summary-collapse">
              <summary>Summary</summary>
              <div className="work-summary-content">
                {pending.citation_information}
                {pending.citation_information && pending.summary && <br />}
                {pending.citation_information && pending.summary && <br />}
                <div
                  className="work-summary"
                  dangerouslySetInnerHTML={{
                    __html: processHtmlForNicks(renderMarkdown(pending.summary)),
                  }}
                />
              </div>
            </details>
          )}
        </>
      )}
      {edit && (
        <div style={{ marginBottom: '4px' }}>
          <TopLevelStandardButton name="Done" shortcut="Ctrl+A" onClick={handleAcceptUpdates} />
        </div>
      )}
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
            <TopLevelStandardButton name="Done" shortcut="Ctrl+Enter" onClick={handleImport} />
          </TopLevelStandardButtonContainer>
        </TopLevelFormContainer>
      ) : (
        <NoteList
          key={`work-${id}-${notesRefreshKey}`}
          viewMode={props.viewMode}
          getListOfNotes={getListOfNotes}
          pageSize={constants.ENTITY_NOTES_PAGE_SIZE}
          hideCitation
        />
      )}
    </>
  )
}

export default Work
