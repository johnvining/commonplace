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
    return (
      <div className="work-list">
        {this.state.works === undefined
          ? null
          : this.state.works.map(work => (
              <ResultWork work={work} key={'work-list-' + work._id} />
            ))}
      </div>
    )
  }
}

export default WorkList
