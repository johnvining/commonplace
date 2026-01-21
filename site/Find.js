import * as constants from './constants'
import * as db from './Database'
import AuthorList from './AuthorList'
import IdeaList from './IdeaList'
import NoteList from './NoteList'
import PileList from './PileList'
import React from 'react'
import WorkList from './WorkList'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'
import {
  TopLevelStandardButton,
  TopLevelStandardButtonContainer,
} from './TopLevelStandardButton'

function Find(props) {
  const { search } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const showNotesOnly = location.pathname.endsWith('/notes')

  const getListOfNotes = async () => {
    return await db.searchNotes(search)
  }

  const getListOfWorks = async () => {
    return await db.getSuggestions(db.types.work, search, true)
  }

  const getListOfIdeas = async () => {
    return await db.getSuggestions(db.types.idea, search, true)
  }

  const getListOfAuthors = async () => {
    return await db.getSuggestions(db.types.auth, search, true)
  }

  const getListOfPiles = async () => {
    return await db.getSuggestions(db.types.pile, search, false)
  }

  props.setPageTitle('Find: ' + search)
  return (
    <div>
      <TopLevelTitleContainer>
        <TopLevelTitle>{search}</TopLevelTitle>
        {showNotesOnly ? (
          <TopLevelSubTitle>Notes</TopLevelSubTitle>
        ) : null}
      </TopLevelTitleContainer>
      <TopLevelStandardButtonContainer className="top-level-toolbar">
        {showNotesOnly ? (
          <TopLevelStandardButton
            name="Back to results"
            onClick={() => navigate('/find/' + search)}
          />
        ) : (
          <TopLevelStandardButton
            name="View notes"
            onClick={() => navigate('/find/' + search + '/notes')}
          />
        )}
      </TopLevelStandardButtonContainer>
      {showNotesOnly ? null : (
        <>
          <PileList key={'pileList' + search} getListOfPiles={getListOfPiles} />
          <AuthorList
            key={'authorList' + search}
            getListOfAuthors={getListOfAuthors}
          />
          <WorkList key={'workList' + search} getListOfWorks={getListOfWorks} />
          <IdeaList key={'ideaList' + search} getListOfIdeas={getListOfIdeas} />
        </>
      )}
      <NoteList
        key={'search-list-' + search + (showNotesOnly ? '-notes' : '')}
        viewMode={showNotesOnly ? props.viewMode : constants.view_modes.RESULT}
        getListOfNotes={getListOfNotes}
      />
    </div>
  )
}

export default Find
