import React from 'react'
import { Link } from 'react-router-dom'
import work_img from 'url:./icons/work.svg'
import PileListForItem from './PileListForItem'
import PinButton from './PinButton'
import { joinAuthorNames } from './authorsDisplay'
import { wornClass, wornTitle } from './utils'

class ResultWork extends React.Component<any, any> {
  state: any = {}

  render() {
    var work = this.props.work
    var pilesToShow = this.props.work.piles
      ?.filter(
        (pile: any) =>
          pile.name?.includes('Location: ') ||
          pile.name?.includes('Status: ') ||
          pile.name?.includes('Reading: '),
      )
      // On a pile's own page its tag would only repeat the page title.
      .filter((pile: any) => pile._id !== this.props.hidePileId)
      .sort((a: any, b: any) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0))

    return (
      <Link to={`/work/${work._id}`}>
        <div className={'result-box' + wornClass(work.openCount)} title={wornTitle(work.openCount)}>
          <div className="result-box header">
            <img src={work_img} />
            <div>
              {work.authors?.length ? <>{joinAuthorNames(work.authors)},&nbsp;</> : null}
              <em>{work.name}</em>
              {work.original_name ? <span className="work-original-name"> ({work.original_name})</span> : null}
              {work.year ? <span className="result-year">{work.year}</span> : null}
            </div>
              <PinButton
                type="work"
                id={work._id}
                label={work.name}
                href={`/work/${work._id}`}
                compact={true}
                className="pin-button-inline"
              />
          </div>
          {work.note_count || pilesToShow?.length || work.ideas?.length ? (
            // One wrapping line under the title: note count, then tags.
            <div className="result-meta">
              {work.note_count ? (
                <span className="result-count">
                  {work.note_count} {work.note_count === 1 ? 'note' : 'notes'}
                </span>
              ) : null}
              <PileListForItem allowTabbing={false} piles={pilesToShow} />
              {work.ideas?.map((idea: any) => (
                <span className="idea label" key={idea._id}>
                  {idea.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    )
  }
}

export default ResultWork
