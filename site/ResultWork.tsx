import React from 'react'
import { Link } from 'react-router-dom'
import work_img from 'url:./icons/work.svg'
import note_img from 'url:./icons/write.svg'
import PileListForItem from './PileListForItem'
import PinButton from './PinButton'
import { joinAuthorNames } from './authorsDisplay'

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
      .sort((a: any, b: any) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0))

    return (
      <Link to={`/work/${work._id}`}>
        <div className="result-box">
          <div className="result-box header">
            <img src={work_img} />
            <div>
              {work.authors?.length ? <>{joinAuthorNames(work.authors)},&nbsp;</> : null}
              <em>{work.name}</em>
              {work.year ? <span className="date">{work.year}</span> : null}
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
          {work.note_count ? (
            <div className="result-box content">
              <img src={note_img} />
              {work.note_count}
            </div>
          ) : null}
          <PileListForItem
            remove={false}
            allowTabbing={false}
            allowAdd={false}
            edit={false}
            piles={pilesToShow}
          />
        </div>
      </Link>
    )
  }
}

export default ResultWork
