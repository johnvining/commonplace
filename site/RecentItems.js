import React from 'react'
import { useParams } from 'react-router-dom'
import * as db from './Database'
import NoteList from './NoteList'
import AuthorList from './AuthorList'
import WorkList from './WorkList'
import IdeaList from './IdeaList'
import PileList from './PileList'
import * as constants from './constants'

function RecentItems(props) {
  const { type } = useParams()

  const getListOfNotes = async () => {
    return await db.getRecentItems('notes')
  }

  const getListOfAuthors = async () => {
    return await db.getRecentItems('authors')
  }

  const getListOfWorks = async () => {
    return await db.getRecentItems('works')
  }

  const getListOfIdeas = async () => {
    return await db.getRecentItems('ideas')
  }

  const getListOfPiles = async () => {
    return await db.getRecentItems('piles')
  }

  const titles = {
    notes: 'Recent Notes',
    authors: 'Recent Authors',
    works: 'Recent Works',
    ideas: 'Recent Ideas',
    piles: 'Recent Piles'
  }

  props.setPageTitle(titles[type] || 'Recent Items')

  switch (type) {
    case 'notes':
      return (
        <div>
          <NoteList
            key={'recent-notes'}
            viewMode={props.viewMode}
            getListOfNotes={getListOfNotes}
          />
        </div>
      )
    case 'authors':
      return (
        <div>
          <AuthorList
            key={'recent-authors'}
            getListOfAuthors={getListOfAuthors}
          />
        </div>
      )
    case 'works':
      return (
        <div>
          <WorkList
            key={'recent-works'}
            getListOfWorks={getListOfWorks}
          />
        </div>
      )
    case 'ideas':
      return (
        <div>
          <IdeaList
            key={'recent-ideas'}
            getListOfIdeas={getListOfIdeas}
          />
        </div>
      )
    case 'piles':
      return (
        <div>
          <PileList
            key={'recent-piles'}
            getListOfPiles={getListOfPiles}
          />
        </div>
      )
    default:
      return <div>Invalid type</div>
  }
}

export default RecentItems

