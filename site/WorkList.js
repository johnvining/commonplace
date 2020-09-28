import React from 'react'
import { Link } from '@reach/router'
import work_img from './icons/work.svg'
import note_img from './icons/write.svg'

class WorkList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfWorks()
    this.setState({
      works: response.data.data
    })
  }

  render() {
    return (
      <div className="work-list">
        {this.state.works === undefined
          ? null
          : this.state.works.map((work, index) => {
              return (
                <Link to={`/work/${work._id}`} key={'work-list-' + work._id}>
                  <div className="result-box">
                    <div className="result-box header">
                      <img src={work_img} />
                      <div>
                        {work.author?.name ? (
                          <>{work.author?.name},&nbsp;</>
                        ) : null}
                        <em>{work.name}</em>
                        {work.year ? (
                          <span className="date">{work.year}</span>
                        ) : null}
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
            })}
      </div>
    )
  }
}

export default WorkList
