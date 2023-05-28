import React from 'react'
import { Link } from 'react-router-dom'
import idea_img from './icons/idea.svg'
import note_img from './icons/write.svg'

class IdeaList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfIdeas()
    this.setState({
      ideas: response.data.data,
    })
  }

  render() {
    return (
      <div className="idea-list">
        {this.state.ideas === undefined ? null : (
          <div>
            {this.state.ideas.map((idea) => {
              return (
                <Link to={`/idea/${idea._id}`} key={'idea-list-' + idea._id}>
                  <div className="result-box">
                    <div className="result-box header">
                      <img src={idea_img} />
                      {idea.name}
                    </div>
                    {idea.note_count ? (
                      <div className="result-box content">
                        <img src={note_img} />
                        {idea.note_count}
                      </div>
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

export default IdeaList
