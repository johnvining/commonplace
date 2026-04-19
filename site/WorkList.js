import React from 'react'
import ResultWork from './ResultWork'

class WorkList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfWorks()
    this.setState({
      works: response.data.data
    })
  }

  render() {
    const works = this.state.works
    const display = works === undefined
      ? null
      : this.props.limit ? works.slice(0, this.props.limit) : works
    return (
      <div className="work-list">
        {works === undefined ? null : works.length === 0 ? (
          <div className="search-empty-state">No works found.</div>
        ) : display.map(work => (
          <ResultWork work={work} key={'work-list-' + work._id} />
        ))}
      </div>
    )
  }
}

export default WorkList
