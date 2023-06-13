import * as constants from './constants'
import * as db from './Database'
import AuthorList from './AuthorList'
import IdeaList from './IdeaList'
import NoteList from './NoteList'
import PileList from './PileList'
import React from 'react'
import WorkList from './WorkList'
import { useParams } from 'react-router-dom'

function Find(props) {
  const { search } = useParams()

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
      <div>
        <span className="title">{search}</span>
      </div>
      <PileList key={'pileList' + search} getListOfPiles={getListOfPiles} />
      <AuthorList
        key={'authorList' + search}
        getListOfAuthors={getListOfAuthors}
      />
      <WorkList key={'workList' + search} getListOfWorks={getListOfWorks} />
      <IdeaList key={'ideaList' + search} getListOfIdeas={getListOfIdeas} />
      <NoteList
        key={'search-list-' + props.search}
        viewMode={constants.view_modes.RESULT}
        getListOfNotes={getListOfNotes}
      />
    </div>
  )
}

export default Find
