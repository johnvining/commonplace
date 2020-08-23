import React, { useRef } from 'react'
import axios from 'axios'
import { Link, redirectTo } from '@reach/router'
import check_circle from './icons/check_circle.svg'
import cross_circle from './icons/cross_circle.svg'
import document_image from './icons/document.svg'
import trash from './icons/trash.svg'
import write from './icons/write.svg'
import plus from './icons/plus.svg'
import check from './icons/check.svg'
import Autocomplete from './Autocomplete'
import * as db from './Database'
import { Model } from 'mongoose'

// TODO: Support clearing authors
// TODO: Support removing idea links
// FIXME: Cancel should return UI to original state
// FIXME: Saving newlines from Text Area doesn't work

class Note extends React.Component {
  state = { loading: true }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)

    this.setState({
      authorId: this.props.authorId,
      author: this.props.author,
      id: this.props.id,
      ideas: this.props.ideas,
      refetch: this.props.refetch,
      text: this.props.text,
      title: this.props.title,
      inFocus: this.props.inFocus
    })
  }

  componentWillUnmount() {
    document.removeEventListener(
      'keydown',
      this.handleKeyDown.bind(this),
      false
    )
  }

  handleKeyDown(event) {
    // TODO: Update to pass in the status rather than the ID from parent
    if (this.props.inFocus != this.props.id) {
      return
    }
    // TODO: Keyboard short cuts will interfere with Ctrl + A on Windows
    if (this.state.edit && event.ctrlKey && event.keyCode == 65) {
      this.handleAccept()
    } else if (!this.state.edit && event.ctrlKey && event.keyCode == 69) {
      this.handleEdit()
    } else if (this.state.edit && event.keyCode == 27) {
      this.handleCancel()
    } else if (!this.state.edit && event.ctrlKey && event.keyCode == 84) {
      this.addIdea()
    }
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
    this.props.becomeInFocus(this.props.id)
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

  // FIXME: When a button is pressed in a note, tell the parent that I now should be inFocus

  render() {
    const {
      addIdea,
      author,
      authorId,
      deleted,
      edit,
      id,
      ideas,
      text,
      title
    } = this.state
    const inFocus = this.props.id == this.props.inFocus

    // Four possible states for a note:
    var mode = { name: 'Normal', class: 'noteNormal-' }
    if (edit) {
      mode.name = 'Editing'
      mode.class = 'noteEdit-'
    } else if (addIdea) {
      mode.name = 'Editing Ideas'
      mode.class = 'noteEditIdea-'
    } else if (inFocus) {
      mode.name = 'In Focus'
      mode.class = 'noteInFocus-'
    }

    // If just deleted, hide
    if (deleted) {
      return <div> </div>
    }

    return (
      <div
        className={mode.class + 'outer'}
        key={this.props.id}
        id={this.props.id}
        tabIndex={this.props.tabIndex}
      >
        <div className={mode.class + 'bar'}>
          <span>
            <small>DEBUG</small> {mode.name}
          </span>
          {edit ? (
            <input
              className={mode.class + 'title'}
              name="title"
              autoFocus
              defaultValue={title}
              onChange={this.handleTitleChange}
            ></input>
          ) : !title?.length ? (
            <div className={mode.class + 'title'}>
              <em>Untitled Note</em>
            </div>
          ) : (
            <div className={mode.class + 'title'}>{title}</div>
          )}
          {edit ? (
            <textarea
              className={mode.class + 'text'}
              onChange={this.handleTextChange}
              value={text}
            ></textarea>
          ) : (
            <div className={mode.class + 'text'}>{text}</div>
          )}
        </div>
        <div className={mode.class + 'author-bar'}>
          {edit ? (
            <Autocomplete
              className={mode.class + 'author-label'}
              defaultValue={author}
              escape={() => {
                this.setState({ edit: false })
              }}
              onSelect={this.handleUpdateAuthor}
              getSuggestions={db.getAuthorSuggestions}
              handleNewSelect={this.handleCreateAuthorAndAssign}
            />
          ) : (
            <div className={mode.class + 'author-label'}>
              <Link to={'/auth/' + authorId} className={mode.class + 'author'}>
                {author}
              </Link>
            </div>
          )}
        </div>
        <div className={mode.class + 'item-bottom'}>
          <div className={mode.class + 'idea-list'}>
            <div className="nothing">
              {ideas?.map(idea => (
                <Link to={'/idea/' + idea._id} key={'idea-link' + idea._id}>
                  <button
                    className={mode.class + 'idea-label'}
                    key={'idea-button' + idea._id}
                    tabIndex="-1"
                  >
                    {idea.name}
                  </button>
                </Link>
              ))}
            </div>
          </div>

          {edit ? (
            <div className={mode.class + 'action-bar'}>
              <span>
                <button
                  className={mode.class + 'action-button'}
                  onClick={this.handleAccept.bind(this)}
                >
                  <img src={check_circle}></img>
                </button>
                <button
                  className={mode.class + 'action-button'}
                  onClick={this.handleCancel.bind(this)}
                >
                  <img src={cross_circle}></img>
                </button>
              </span>
            </div>
          ) : (
            <div className={mode.class + 'actionBar'}>
              {this.state.addIdea ? (
                <Autocomplete
                  className={mode.class + 'idea'}
                  escape={() => {
                    this.setState({ addIdea: false })
                  }}
                  onSelect={this.handleNewTopic}
                  handleNewSelect={this.handleCreateTopicAndAssign}
                  getSuggestions={db.getIdeaSuggestions}
                />
              ) : (
                // Neither editing whole note nor ideas
                <span className="nothing">
                  <button
                    className={mode.class + 'action-button'}
                    onClick={this.addIdea.bind(this)}
                    tabIndex="-1"
                  >
                    <img src={plus}></img>
                  </button>
                  <Link to={'/note/' + id}>
                    <button
                      className={mode.class + 'action-button'}
                      tabIndex="-1"
                    >
                      <img src={document_image}></img>
                    </button>
                  </Link>

                  <button
                    className={mode.class + 'action-button'}
                    onClick={this.handleEdit.bind(this)}
                    tabIndex="-1"
                  >
                    <img src={write}></img>
                  </button>
                  <button
                    onClick={this.handleDelete.bind(this)}
                    className={mode.class + 'action-button'}
                    tabIndex="-1"
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
