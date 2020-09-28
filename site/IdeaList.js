import React from 'react'
import { Link } from '@reach/router'
import idea_img from './icons/idea.svg'

class IdeaList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfIdeas()
    this.setState({
      ideas: response.data.data
    })
  }

  render() {
    return (
      <div className="idea-list">
        {this.state.ideas === undefined ? null : (
          <div>
            {this.state.ideas.map((idea, index) => {
              return (
                <Link to={`/idea/${idea._id}`} key={'idea-list-' + idea._id}>
                  <div className="result-box">
                    <img src={idea_img} />
                    {idea.name}
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

export default IdeaList
