import React from 'react'
import { Link } from 'react-router-dom'
import work_img from './icons/work.svg'
import note_img from './icons/write.svg'

class ResultWork extends React.Component {
  state = {}

  render() {
    var work = this.props.work
    return (
      <Link to={`/work/${work._id}`}>
        <div className="result-box">
          <div className="result-box header">
            <img src={work_img} />
            <div>
              {work.author?.name ? <>{work.author?.name},&nbsp;</> : null}
              <em>{work.name}</em>
              {work.year ? <span className="date">{work.year}</span> : null}
            </div>
          </div>
          {work.note_count ? (
            <div className="result-box content">
              <img src={note_img} />
              {work.note_count}
            </div>
          ) : null}
        </div>
      </Link>
    )
  }
}

export default ResultWork
