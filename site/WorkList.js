import React from 'react'
import { Link } from '@reach/router'

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
        {this.state.works === undefined ? null : (
          <div>
            {this.state.works.map((work, index) => {
              return (
                <Link to={`/work/${work._id}`} key={'work-list-' + work._id}>
                  <div className="work">
                    {work.author?.name ? (
                      <span>{work.author?.name}, </span>
                    ) : null}
                    <em>{work.name}</em>
                    {work.year ? (
                      <span className="date">{work.year}</span>
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }
}

export default WorkList
