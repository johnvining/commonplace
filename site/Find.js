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
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'

const LIMIT = 5

function SearchGroup({ label, search, category, items, renderItem }) {
  if (!items || items.length === 0) return null
  return (
    <div className="search-group">
      <div className="search-group-header">
        <span className="search-group-label">{label}</span>
        {items.length >= LIMIT && (
          <Link
            to={`/find/${encodeURIComponent(search)}/${category}`}
            className="search-group-see-all"
          >
            See all →
          </Link>
        )}
      </div>
      {items.slice(0, LIMIT).map(renderItem)}
    </div>
  )
}

function Find(props) {
  const { search, category } = useParams()
  const [results, setResults] = React.useState(null)

  React.useEffect(() => {
    setResults(null)
    Promise.all([
      db.searchNotes(search),
      db.getSuggestions(db.types.work, search, true),
      db.getSuggestions(db.types.idea, search, true),
      db.getSuggestions(db.types.auth, search, true),
      db.getSuggestions(db.types.pile, search, false),
    ]).then(([notes, works, ideas, authors, piles]) => {
      setResults({
        notes: notes.data.data,
        works: works.data.data,
        ideas: ideas.data.data,
        authors: authors.data.data,
        piles: piles.data.data,
      })
    })
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

  // Main search page
  const loading = results === null
  const nothing =
    results &&
    results.notes.length === 0 &&
    results.works.length === 0 &&
    results.ideas.length === 0 &&
    results.authors.length === 0 &&
    results.piles.length === 0

  return (
    <div>
      <TopLevelTitleContainer>
        <TopLevelTitle>{search}</TopLevelTitle>
      </TopLevelTitleContainer>

      {loading ? null : nothing ? (
        <div className="search-no-results">No results for "{search}"</div>
      ) : (
        <div>
          <SearchGroup
            label="Notes"
            search={search}
            category="notes"
            items={results.notes}
            renderItem={note => <NoteResult note={note} key={note._id} highlight={search} />}
          />

          <SearchGroup
            label="Works"
            search={search}
            category="work"
            items={results.works}
            renderItem={work => (
              <Link to={`/work/${work._id}`} key={work._id}>
                <div className="result-box">
                  <div className="result-box header">
                    <img src={work_img} />
                    <span className="truncate">
                      {work.author?.name ? <>{highlight(work.author.name, search)},&nbsp;</> : null}
                      <em>{highlight(work.name, search)}</em>
                      {work.year ? <span className="date">&nbsp;{work.year}</span> : null}
                    </span>
                    <PinButton type="work" id={work._id} label={work.name} href={`/work/${work._id}`} compact={true} className="pin-button-inline" />
                  </div>
                </div>
              </Link>
            )}
          />

          <SearchGroup
            label="Authors"
            search={search}
            category="auth"
            items={results.authors}
            renderItem={author => (
              <Link to={`/auth/${author._id}`} key={author._id}>
                <div className="result-box">
                  <div className="result-box header">
                    <img src={author_img} />
                    <span className="truncate">{highlight(author.name, search)}</span>
                    <PinButton type="auth" id={author._id} label={author.name} href={`/auth/${author._id}`} compact={true} className="pin-button-inline" />
                  </div>
                </div>
              </Link>
            )}
          />

          <SearchGroup
            label="Ideas"
            search={search}
            category="idea"
            items={results.ideas}
            renderItem={idea => (
              <Link to={`/idea/${idea._id}`} key={idea._id}>
                <div className="result-box">
                  <div className="result-box header">
                    <img src={idea_img} />
                    <span className="truncate">{highlight(idea.name, search)}</span>
                    <PinButton type="idea" id={idea._id} label={idea.name} href={`/idea/${idea._id}`} compact={true} className="pin-button-inline" />
                  </div>
                </div>
              </Link>
            )}
          />

          <SearchGroup
            label="Piles"
            search={search}
            category="pile"
            items={results.piles}
            renderItem={pile => (
              <Link to={`/pile/${pile._id}`} key={pile._id}>
                <div className="result-box">
                  <div className="result-box header">
                    <img src={pile_img} />
                    <span className="truncate">{highlight(pile.name, search)}</span>
                    <PinButton type="pile" id={pile._id} label={pile.name} href={`/pile/${pile._id}`} compact={true} className="pin-button-inline" />
                  </div>
                </div>
              </Link>
            )}
          />
        </div>
      )}
    </div>
  )
}

export default Find
