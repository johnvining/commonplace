import { useNavigate, useParams } from 'react-router-dom'
import PileName from './PileName'
import * as constants from './constants'
import * as db from './Database'
import Missing, { isNotFound, whatBecameOf } from './Missing'
import { titleWithNick } from './utils'
import NoteList from './NoteList'
import WorkList from './WorkList'
import YearSpan from './YearSpan'
import { useState, useEffect } from 'react'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'
import { useEntityEditor } from './useEntityEditor'
import EntityOverview from './EntityOverview'
import autosize from 'autosize'
import ClickToCopyNick from './ClickToCopyNick'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormInput, TopLevelFormContainer, TopLevelFormTextArea } from './TopLevelFormItems'
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'
import { TopLevelStarButton } from './PinButton'
import { togglePinned } from './pinned'

function Pile(props: any) {
  const { id = '' } = useParams()
  const editor = useEntityEditor(db.types.pile, id, {
    name: '',
    start_year: '' as number | string,
    end_year: '' as number | string,
    text: '',
  })
  const { editing: edit, setEditing: setEdit, values: pending } = editor
  const [nick, setNick] = useState('')
  // Set when the pile doesn't exist (#387)
  const [missing, setMissing] = useState<{ name?: string | null } | null>(null)
  const navigate = useNavigate()

  const fetchPileInfo = (pileId: any) => {
    setMissing(null)
    Promise.all([
      db.getInfo(db.types.pile, pileId),
      db.getPileNick(pileId),
    ]).then(([infoResponse, nickResponse]) => {
      const pile = infoResponse.data.data
      editor.load({
        name: pile.name,
        start_year: pile.start_year ?? '',
        end_year: pile.end_year ?? '',
        text: pile.text ?? '',
      })
      setNick(nickResponse.data.data.key)
    }).catch((error: any) => {
      if (!isNotFound(error)) return console.error(error)
      // Gone: say so, with its name if its nick kept one (#387)
      whatBecameOf('pile', pileId).then(({ forwardTo, name }) => {
        if (forwardTo) navigate('/pile/' + forwardTo, { replace: true })
        else setMissing({ name })
      })
    })
  }

  useEffect(() => {
    fetchPileInfo(id)
  }, [id])

  const handleDeletePile = async () => {
    if (!confirm(`Do you want to permanently delete '${pending.name}'?`)) {
      return
    }

    await db.deleteRecord(db.types.pile, id)
    navigate('/')
  }

  const getListOfNotes = async (_index: any, page: number) => {
    var notesResponse
    await db
      .getNotesPageForEntity(db.types.pile, id, page)
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  const getListOfWorks = async () => {
    var worksResponse
    await db
      .getRecordsWithFilter(db.types.work, db.types.pile, id)
      .then((response: any) => {
        worksResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return worksResponse
  }

  const handleAcceptUpdates = () => editor.save()

  const createNoteForPile = async () => {
    try {
      const response = await db.createNewNoteFromTitle('')
      const noteId = response?.data?._id
      if (!noteId) {
        console.error('Create note response missing id', response)
        return
      }
      // Add the pile to the new note
      await db.addLinkToRecord(db.types.pile, id, db.types.note, noteId)
      navigate('/note/' + noteId + '/edit')
    } catch (error: any) {
      console.error('Error creating note for pile', error)
    }
  }

  const toggleStar = () => {
    if (!id) return
    togglePinned({
      type: 'pile',
      id,
      label: pending.name,
      href: `/pile/${id}`,
    })
  }

  // Section 3.1 & 3.4: Pile page keyboard shortcuts
  useEntityKeyboardShortcuts({
    isEditing: edit,
    onEdit: () => setEdit(true),
    onSave: handleAcceptUpdates,
    onExitEdit: editor.cancel,
    onNewNote: createNoteForPile,
    onToggleStar: toggleStar,
    onDelete: handleDeletePile,
    onViewNotes: () => navigate(props.showNotes ? '/pile/' + id : '/pile/' + id + '/notes'),
    onNarrow: () => navigate('/filter?piles=' + id),
  })

  if (missing) {
    props.setPageTitle('Pile does not exist')
    return <Missing type="pile" name={missing.name} />
  }

  props.setPageTitle(titleWithNick(pending.name, nick))
  return (
    <div>
      {/* Header and Edit */}
      <div key="pile-information">
        {edit ? (
          <TopLevelFormContainer>
            <TopLevelFormInput
              name="Name"
              id="title"
              autoFocus
              defaultValue={pending.name}
              onChange={(e: any) => {
                editor.set('name', e.target.value)
              }}
            />
            <TopLevelFormInput
              name="Start Year"
              id="startYear"
              defaultValue={pending.start_year}
              onChange={(e: any) => {
                editor.set('start_year', e.target.value)
              }}
            />
            <TopLevelFormInput
              name="End Year"
              id="endYear"
              defaultValue={pending.end_year}
              onChange={(e: any) => {
                editor.set('end_year', e.target.value)
              }}
            />
            <TopLevelFormTextArea
              name="Overview"
              id="overview"
              value={pending.text}
              onChange={(e: any) => {
                editor.set('text', e.target.value)
                autosize(document.querySelector('#overview') as HTMLElement)
              }}
            />
            <TopLevelStandardButtonContainer>
              <TopLevelStandardButton name="Done" shortcut="Ctrl+A" position="left" onClick={handleAcceptUpdates} />
              <TopLevelStandardButton name="Cancel" shortcut="Esc" position="right" onClick={editor.cancel} />
            </TopLevelStandardButtonContainer>
          </TopLevelFormContainer>
        ) : (
          <div className="entity-page-header">
            <div className="entity-page-header-left">
              <div className="entity-page-title"><PileName name={pending.name} /></div>
              {(pending.start_year || pending.end_year) && (
                <div className="entity-page-byline">
                  {pending.start_year ? <YearSpan year={pending.start_year} /> : null}
                  {pending.start_year && pending.end_year ? ' • ' : null}
                  {pending.end_year ? <YearSpan year={pending.end_year} /> : null}
                </div>
              )}
              {nick && (
                <div className="entity-page-nick">
                  <ClickToCopyNick nick={nick} />
                </div>
              )}
            </div>
            <div className="entity-page-header-right">
              <TopLevelStandardButtonContainer className="top-level-toolbar">
                <TopLevelStarButton
                  type="pile"
                  id={id}
                  label={pending.name}
                  href={`/pile/${id}`}
                />
                <TopLevelStandardButton
                  name="Edit"
                  shortcut="Ctrl+E"
                  onClick={() => {
                    setEdit(true)
                  }}
                />
                {!props.showNotes ? (
                  <TopLevelStandardButton
                    name="View notes"
                    shortcut="v"
                    onClick={() => {
                      navigate('/pile/' + id + '/notes')
                    }}
                  />
                ) : (
                  <TopLevelStandardButton
                    name="View all"
                    shortcut="v"
                    onClick={() => {
                      navigate('/pile/' + id)
                    }}
                  />
                )}
                <TopLevelStandardButton name="Add Note" shortcut="Ctrl+N" onClick={createNoteForPile} />
                <TopLevelStandardButton
                  name="Narrow"
                  shortcut="f"
                  onClick={() => navigate('/filter?piles=' + id)}
                />
                <TopLevelStandardButton
                  name="Delete"
                  shortcut="#"
                  onClick={handleDeletePile}
                />
              </TopLevelStandardButtonContainer>
            </div>
          </div>
        )}
      </div>

      {edit ? null : <EntityOverview text={pending.text} />}
      {/* Note and Work List */}
      {props.showNotes ? (
        <NoteList
          key={'noteList' + id}
          viewMode={props.viewMode}
          getListOfNotes={getListOfNotes}
          pageSize={constants.ENTITY_NOTES_PAGE_SIZE}
        />
      ) : (
        <>
          <WorkList key={'workList' + id} getListOfWorks={getListOfWorks} hidePileId={id} />
          <NoteList
            key={'noteList' + id}
            viewMode={constants.view_modes.RESULT}
            getListOfNotes={getListOfNotes}
            pageSize={constants.ENTITY_NOTES_PAGE_SIZE}
          />
        </>
      )}
    </div>
  )
}

export default Pile
