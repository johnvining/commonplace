import React, { useRef } from 'react'
import axios from 'axios'
import { Link, redirectTo } from '@reach/router'
import check_circle from './icons/check_circle.svg'
import cross_circle from './icons/cross_circle.svg'
import document from './icons/document.svg'
import trash from './icons/trash.svg'
import write from './icons/write.svg'
import plus from './icons/plus.svg'
import check from './icons/check.svg'
import Autocomplete from './Autocomplete'
import * as db from './Database'

class Note extends React.Component {
  state = { loading: true }

  componentDidMount() {
    this.setState({
      authorId: this.props.authorId,
      author: this.props.author,
      id: this.props.id,
      ideas: this.props.ideas,
      refetch: this.props.refetch,
      text: this.props.text,
      title: this.props.title
    })
  }

  // TODO: https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html
  static getDerivedStateFromProps(next, prev) {
    if (prev.edit || prev.keep) {
      return prev
    } else {
      return {
        authorId: next.authorId,
        author: next.author,
        title: next.title,
        text: next.text,
        ideas: next.ideas,
        id: next.id
      }
    }
  }

  handleDelete() {
    if (confirm('Are you sure you want to delete this note?')) {
      db.deleteNote(this.props.id)
        .then(() => {
          this.setState({ deleted: true })
        })
        .catch(error => {
          console.log(error)
        })
    }
  }

  handleCancel() {
    this.setState({ edit: false })
  }

  handleEdit() {
    this.setState({ edit: true })
  }

  addIdea() {
    this.setState({ addIdea: true })
    this.setState({ focus: this })
  }

  endIdea() {
    this.setState({ addIdea: false })
  }

  handleTitleChange = val => {
    this.setState({ title: val.target.value })
  }

  handleTextChange = val => {
    this.setState({ text: val.target.value })
  }

  handleNewTopic = topicID => {
    db.addIdeaToNote(topicID, this.props.id)
      .then(() => {
        this.setState({ addIdea: false })
        this.state.refetch()
      })
      .catch(e => {
        console.log(e)
      })
  }

  handleCreateTopicAndAssign = topicName => {
    db.createTopicAndAssign(topicName, this.props.id)
      .then(() => {
        this.setState({ addIdea: false })
        this.state.refetch()
      })
      .catch(e => {
        console.log(e)
      })
  }

  handleUpdateAuthor = (authorId, authorName) => {
    this.setState({ authorId: authorId, author: authorName })
  }

  handleCreateAuthorAndAssign = authorName => {
    db.createAuthor(authorName).then(response => {
      this.setState({ authorId: response.data.data.id, author: authorName })
    })
  }

  async handleAccept() {
    const updateObject = {
      title: this.state.title,
      text: this.state.text,
      author: this.state.authorId
    }

    this.setState({ edit: false, keep: true })
    await db
      .updateNoteInfo(this.state.id, updateObject)
      .then()
      .catch(error => {
        console.log(error)
      })
  }

  render() {
    const { title, id, author, ideas, text, authorId, edit } = this.state

    if (this.state.deleted) {
      return <div> </div>
    }

    return (
      <div
        className={edit ? 'quote-instance-edit' : 'quote-instance'}
        key={this.props.id}
      >
        <div className="quote-bar">
          {edit ? (
            <input
              className="quote-title"
              name="title"
              autoFocus
              defaultValue={title}
              onChange={this.handleTitleChange}
            ></input>
          ) : !title?.length ? (
            <div className="quote-title">
              <em>Untitled Note</em>
            </div>
          ) : (
            <div className="quote-title">{title}</div>
          )}
          {edit ? (
            <textarea
              className="quote-text"
              onChange={this.handleTextChange}
              value={text}
            ></textarea>
          ) : (
            <div className="quote-text">{text}</div>
          )}
        </div>
        <div className="author-bar">
          {edit ? (
            <Autocomplete
              className="author-label"
              defaultValue={author}
              escape={() => {
                this.setState({ edit: false })
              }}
              onSelect={this.handleUpdateAuthor}
              getSuggestions={db.getAuthorSuggestions}
              handleNewSelect={this.handleCreateAuthorAndAssign}
            />
          ) : (
            <div className={'author-label'}>
              <Link to={'/auth/' + authorId} className="author">
                {author}
              </Link>
            </div>
          )}
        </div>
        <div className="item-bottom">
          <div className="idea-list">
            <div className="nothing">
              {ideas?.map(idea => (
                <Link to={'/idea/' + idea._id} key={'idea-link' + idea._id}>
                  <button className="idea-label" key={'idea-button' + idea._id}>
                    {idea.name}
                  </button>
                </Link>
              ))}
            </div>
          </div>

          {edit ? (
            <div className="action-bar">
              <span>
                <button
                  className="action-button"
                  onClick={this.handleAccept.bind(this)}
                >
                  <img src={check_circle}></img>
                </button>
                <button
                  className="action-button"
                  onClick={this.handleCancel.bind(this)}
                >
                  <img src={cross_circle}></img>
                </button>
              </span>
            </div>
          ) : (
            <div className="actionBar">
              {this.state.addIdea ? (
                <Autocomplete
                  className="idea"
                  exitButtonImage={check}
                  escape={() => {
                    this.setState({ addIdea: false })
                  }}
                  onSelect={this.handleNewTopic}
                  handleNewSelect={this.handleCreateTopicAndAssign}
                  getSuggestions={db.getIdeaSuggestions}
                />
              ) : (
                // // </div>
                // Neither editing whole note nor ideas
                <span className="nothing">
                  <button
                    className="action-button"
                    onClick={this.addIdea.bind(this)}
                  >
                    <img src={plus}></img>
                  </button>
                  <Link to={'/note/' + id}>
                    <button className="action-button">
                      <img src={document}></img>
                    </button>
                  </Link>

                  <button
                    className="action-button"
                    onClick={this.handleEdit.bind(this)}
                  >
                    <img src={write}></img>
                  </button>
                  <button
                    onClick={this.handleDelete.bind(this)}
                    className="action-button"
                  >
                    <img src={trash}></img>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

// TODO: Update the ideas display to work everywhere
// TODO: Create an idea page and API

export default Note
