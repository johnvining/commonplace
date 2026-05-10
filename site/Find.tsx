import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import NoteResult from './NoteResult'
import WorkList from './WorkList'
import IdeaList from './IdeaList'
import AuthorList from './AuthorList'
import PileList from './PileList'
import React from 'react'
import { Link, useParams } from 'react-router-dom'
import work_img from 'url:./icons/work.svg'
import author_img from 'url:./icons/author.svg'
import idea_img from 'url:./icons/idea.svg'
import pile_img from 'url:./icons/stack.svg'
import PinButton from './PinButton'
import left from 'url:./icons/left.svg'
import right from 'url:./icons/right.svg'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'

function highlight(text, query) {
  if (!text || !query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const PAGE_SIZE = 20


function UnifiedResult({ entry, query }: any) {
  const { type, item } = entry

  if (type === 'note') {
    return <NoteResult note={item} highlight={query} semantic={item._semantic} />
  }

  if (type === 'work') {
    return (
      <Link to={`/work/${item._id}`}>
        <div className="result-box">
          <div className="result-box header">
            <img src={work_img} />
            <span className="truncate">
              {item.author?.name ? <>{highlight(item.author.name, query)},&nbsp;</> : null}
              <em>{highlight(item.name, query)}</em>
              {item.year ? <span className="date">&nbsp;{item.year}</span> : null}
            </span>
            <PinButton type="work" id={item._id} label={item.name} href={`/work/${item._id}`} compact={true} className="pin-button-inline" />
          </div>
        </div>
      </Link>
    )
  }

  if (type === 'auth') {
    return (
      <Link to={`/auth/${item._id}`}>
        <div className="result-box">
          <div className="result-box header">
            <img src={author_img} />
            <span className="truncate">{highlight(item.name, query)}</span>
            <PinButton type="auth" id={item._id} label={item.name} href={`/auth/${item._id}`} compact={true} className="pin-button-inline" />
          </div>
        </div>
      </Link>
    )
  }

  if (type === 'idea') {
    return (
      <Link to={`/idea/${item._id}`}>
        <div className="result-box">
          <div className="result-box header">
            <img src={idea_img} />
            <span className="truncate">{highlight(item.name, query)}</span>
            <PinButton type="idea" id={item._id} label={item.name} href={`/idea/${item._id}`} compact={true} className="pin-button-inline" />
          </div>
        </div>
      </Link>
    )
  }

  if (type === 'pile') {
    return (
      <Link to={`/pile/${item._id}`}>
        <div className="result-box">
          <div className="result-box header">
            <img src={pile_img} />
            <span className="truncate">{highlight(item.name, query)}</span>
            <PinButton type="pile" id={item._id} label={item.name} href={`/pile/${item._id}`} compact={true} className="pin-button-inline" />
          </div>
        </div>
      </Link>
    )
  }

  return null
}

function Find(props: any) {
  const { search, category } = useParams()
  const [results, setResults] = React.useState(null)
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setResults(null)
    setPage(1)

    db.unifiedSearch(search, 50, signal)
      .then(res => { if (!signal.aborted) setResults(res.data.data) })
      .catch(() => { if (!signal.aborted) setResults([]) })

    return () => controller.abort()
  }, [search])

  const getListOfNotes = async () => db.searchNotes(search)
  const getListOfWorks = async () => db.getSuggestions(db.types.work, search, true)
  const getListOfIdeas = async () => db.getSuggestions(db.types.idea, search, true)
  const getListOfAuthors = async () => db.getSuggestions(db.types.auth, search, true)
  const getListOfPiles = async () => db.getSuggestions(db.types.pile, search, false)

  props.setPageTitle('Find: ' + search)

  // Category-specific full views
  if (category === 'notes') {
    return (
      <div>
        <TopLevelTitleContainer>
          <TopLevelTitle>{search}</TopLevelTitle>
          <TopLevelSubTitle>Notes</TopLevelSubTitle>
        </TopLevelTitleContainer>
        <NoteList
          key={'notes-all-' + search}
          viewMode={constants.view_modes.SLIM}
          getListOfNotes={getListOfNotes}
        />
      </div>
    )
  }
  if (category === 'work') {
    return (
      <div>
        <TopLevelTitleContainer>
          <TopLevelTitle>{search}</TopLevelTitle>
          <TopLevelSubTitle>Works</TopLevelSubTitle>
        </TopLevelTitleContainer>
        <WorkList key={'works-all-' + search} getListOfWorks={getListOfWorks} />
      </div>
    )
  }
  if (category === 'idea') {
    return (
      <div>
        <TopLevelTitleContainer>
          <TopLevelTitle>{search}</TopLevelTitle>
          <TopLevelSubTitle>Ideas</TopLevelSubTitle>
        </TopLevelTitleContainer>
        <IdeaList key={'ideas-all-' + search} getListOfIdeas={getListOfIdeas} />
      </div>
    )
  }
  if (category === 'auth') {
    return (
      <div>
        <TopLevelTitleContainer>
          <TopLevelTitle>{search}</TopLevelTitle>
          <TopLevelSubTitle>Authors</TopLevelSubTitle>
        </TopLevelTitleContainer>
        <AuthorList key={'authors-all-' + search} getListOfAuthors={getListOfAuthors} />
      </div>
    )
  }
  if (category === 'pile') {
    return (
      <div>
        <TopLevelTitleContainer>
          <TopLevelTitle>{search}</TopLevelTitle>
          <TopLevelSubTitle>Piles</TopLevelSubTitle>
        </TopLevelTitleContainer>
        <PileList key={'piles-all-' + search} getListOfPiles={getListOfPiles} />
      </div>
    )
  }

  // Main unified search page
  const totalPages = results ? Math.ceil(results.length / PAGE_SIZE) : 0
  const pageItems = results ? results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []

  return (
    <div>
      <TopLevelTitleContainer>
        <TopLevelTitle>{search}</TopLevelTitle>
      </TopLevelTitleContainer>

      {results === null ? (
        <div className="search-loading-state">Loading...</div>
      ) : results.length === 0 ? (
        <div className="search-no-results">No results for "{search}"</div>
      ) : (
        <>
          {pageItems.map((entry) => (
            <UnifiedResult key={entry.type + '-' + String(entry.item._id)} entry={entry} query={search} />
          ))}

          {totalPages > 1 && (
            <TopLevelStandardButtonContainer>
              <TopLevelStandardButton
                position={page === 1 ? 'hidden' : 'left'}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <img src={left} />
              </TopLevelStandardButton>
              <TopLevelStandardButton
                position={page === totalPages ? 'right' : 'left-right'}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <img src={right} />
              </TopLevelStandardButton>
            </TopLevelStandardButtonContainer>
          )}
        </>
      )}
    </div>
  )
}

export default Find
