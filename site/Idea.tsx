import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import { titleWithNick } from './utils'
import * as constants from './constants'
import NoteList from './NoteList'
import WorkList from './WorkList'
import YearSpan from './YearSpan'
import { useState, useEffect } from 'react'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormContainer, TopLevelFormInput, TopLevelFormTextArea } from './TopLevelFormItems'
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'
import { useEntityKeyboardShortcuts } from './useEntityKeyboardShortcuts'
import { TopLevelStarButton } from './PinButton'
import ClickToCopyNick from './ClickToCopyNick'
import { togglePinned } from './pinned'
import { useEntityEditor } from './useEntityEditor'
import EntityOverview from './EntityOverview'
import autosize from 'autosize'

function Idea(props: any) {
  const { id = '' } = useParams()
  const editor = useEntityEditor(db.types.idea, id, {
    name: '',
    start_year: '' as number | string,
    end_year: '' as number | string,
    person: false,
    text: '',
  })
  const { editing: edit, setEditing: setEdit, values: pending } = editor
  const [nick, setNick] = useState('')
  const navigate = useNavigate()

  const fetchIdeaInfo = (ideaId: any) => {
    Promise.all([
      db.getInfo(db.types.idea, ideaId),
      db.getIdeaNick(ideaId),
    ]).then(([infoResponse, nickResponse]) => {
      const idea = infoResponse.data.data
      editor.load({
        name: idea.name,
        start_year: idea.start_year ?? '',
        end_year: idea.end_year ?? '',
        person: Boolean(idea.person),
        text: idea.text ?? '',
      })
      setNick(nickResponse.data.data.key)
    }).catch((error: any) => {
      console.error(error)
    })
  }

  useEffect(() => {
    fetchIdeaInfo(id)
  }, [id])

  const getListOfNotes = async (_index: any, page: number) => {
    var notesResponse
    await db
      .getNotesPageForEntity(db.types.idea, id, page)
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  const deleteIdea = async () => {
    if (!confirm(`Do you want to permanently delete '${pending.name}'?`)) {
      return
    }

    await db.deleteRecord(db.types.idea, id)
    navigate('/')
  }

  const handleAcceptUpdates = () => editor.save()

  const createNoteForIdea = async () => {
    try {
      const response = await db.createNewNoteFromTitle('')
      const noteId = response?.data?._id
      if (!noteId) {
        console.error('Create note response missing id', response)
        return
      }
      // Add the idea to the new note
      await db.addLinkToRecord(db.types.idea, id, db.types.note, noteId)
      navigate('/note/' + noteId + '/edit')
    } catch (error: any) {
      console.error('Error creating note for idea', error)
    }
  }

  const toggleStar = () => {
    if (!id) return
    togglePinned({
      type: 'idea',
      id,
      label: pending.name,
      href: `/idea/${id}`,
    })
  }

  // Section 3.1 & 3.5: Idea page keyboard shortcuts
  useEntityKeyboardShortcuts({
    isEditing: edit,
    onEdit: () => setEdit(true),
    onSave: handleAcceptUpdates,
    onExitEdit: editor.cancel,
    onNewNote: createNoteForIdea,
    onToggleStar: toggleStar,
  })

  props.setPageTitle(titleWithNick(pending.name, nick))

  return (
    <div>
      <div key="idea-information">
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
            <label htmlFor="person" className="top-level form-label">
              <input
                id="person"
                type="checkbox"
                checked={pending.person}
                onChange={(e: any) => editor.set('person', e.target.checked)}
              />{' '}
              This idea is a person
            </label>
            <TopLevelFormTextArea
              name="Overview"
              id="overview"
              value={pending.text}
              onChange={(e: any) => {
                editor.set('text', e.target.value)
                autosize(document.querySelector('#overview') as HTMLElement)
              }}
            />
            <TopLevelStandardButton name="Done" onClick={handleAcceptUpdates} />
          </TopLevelFormContainer>
        ) : (
          <div className="entity-page-header">
            <div className="entity-page-header-left">
              <div className="entity-page-title">{pending.name}</div>
              {(pending.person || pending.start_year || pending.end_year) && (
                <div className="entity-page-byline">
                  {pending.person ? 'Person' : null}
                  {pending.person && (pending.start_year || pending.end_year) ? ' • ' : null}
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
                  type="idea"
                  id={id}
                  label={pending.name}
                  href={`/idea/${id}`}
                />
                <TopLevelStandardButton
                  name="Edit"
                  onClick={() => {
                    setEdit(true)
                  }}
                />
                <TopLevelStandardButton
                  name="Narrow"
                  onClick={() => navigate('/filter?ideas=' + id)}
                />
                <TopLevelStandardButton name="Delete" onClick={deleteIdea} />
              </TopLevelStandardButtonContainer>
            </div>
          </div>
        )}
      </div>

      {edit ? null : <EntityOverview text={pending.text} />}
      <WorkList
        key={'ideaWorks' + id}
        getListOfWorks={() => db.getRecordsWithFilter(db.types.work, db.types.idea, id)}
        hideWhenEmpty
      />
      <NoteList
        key={'idea' + id}
        viewMode={props.viewMode}
        getListOfNotes={getListOfNotes}
        pageSize={constants.ENTITY_NOTES_PAGE_SIZE}
      />
    </div>
  )
}

export default Idea
