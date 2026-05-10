import React from 'react'
import { Link } from 'react-router-dom'
import idea_img from 'url:./icons/idea.svg'
import note_img from 'url:./icons/write.svg'
import PinButton from './PinButton'

class IdeaList extends React.Component<any, any> {
  state: any = {}

  async componentDidMount() {
    const response = await this.props.getListOfIdeas()
    this.setState({
      ideas: response.data.data,
    })
  }

  render() {
    return (
      <div className="idea-list">
        {this.state.ideas === undefined ? null : this.state.ideas.length === 0 ? (
          <div className="search-empty-state">No ideas found.</div>
        ) : (
          <div>
            {(this.props.limit ? this.state.ideas.slice(0, this.props.limit) : this.state.ideas).map((idea) => {
              return (
                <Link to={`/idea/${idea._id}`} key={'idea-list-' + idea._id}>
                  <div className="result-box">
                    <div className="result-box header">
                      <img src={idea_img} />
                      {idea.name}
                      <PinButton
                        type="idea"
                        id={idea._id}
                        label={idea.name}
                        href={`/idea/${idea._id}`}
                        compact={true}
                        className="pin-button-inline"
                      />
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
