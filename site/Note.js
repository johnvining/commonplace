import React from 'react'
import { Link } from '@reach/router'
import check_circle from './icons/check_circle.svg'
import cross_circle from './icons/cross_circle.svg'
import document_image from './icons/document.svg'
import trash from './icons/trash.svg'
import write from './icons/write.svg'
import plus from './icons/plus.svg'
import Autocomplete from './Autocomplete'
import * as db from './Database'
import link from './icons/link.svg'

// TODO: Support clearing authors
// TODO: Support removing idea links
// FIXME: Cancel should return UI to original state
// FIXME: Saving newlines from Text Area doesn't work

class Note extends React.Component {
  state = {
    pendingTitle: '',
    pendingText: '',
    pendingAuthorId: null,
    pendingAuthorName: '',
    pendingWorkId: null,
    pendingWorkName: ''
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)

    // TODO: Do we need?
    this.setState({
      inFocus: this.props.inFocus,
      pendingTitle: this.props.note.title,
      pendingText: this.props.note.text,
      pendingAuthorId: this.props.note.author?._id,
      pendingAuthorName: this.props.note.author?.name,
      pendingWorkId: this.props.note.work?._id,
      pendingWorkName: this.props.note.work?.name
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

  handleDelete() {
    if (confirm('Are you sure you want to delete this note?')) {
      db.deleteNote(this.props.id)
        .then(() => {
          this.setState({ deleted: true })
        })
        .catch(error => {
          console.error(error)
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
    this.setState({ addIdea: true, focus: this })
  }

  endIdea() {
    this.setState({ addIdea: false })
  }

  handleTitleChange = val => {
    this.setState({ pendingTitle: val.target.value })
  }

  handleTextChange = val => {
    this.setState({ pendingText: val.target.value })
  }

  handleNewTopic = ideaId => {
    db.addIdeaToNote(ideaId, this.props.id)
      .then(() => {
        this.props.refetchMe(this.props.index)
      })
      .catch(e => {
        console.error(e)
      })
  }

  // TODO: Clear entry after assignment
  handleCreateTopicAndAssign = ideaName => {
    db.createTopicAndAssign(ideaName, this.props.id)
      .then(() => {
        this.props.refetchMe(this.props.index)
      })

      .catch(e => {
        console.error(e)
      })
  }

  handleUpdateAuthor = (authorId, authorName) => {
    this.setState({ pendingAuthorName: authorName, pendingAuthorId: authorId })
  }

  handleCreateAuthorAndAssign = authorName => {
    db.createAuthor(authorName).then(response => {
      this.setState({
        pendingAuthorId: response.data.data._id,
        pendingAuthorName: authorName
      })
    })
  }

  handleUpdateWork = (workId, workName) => {
    this.setState({ pendingWorkId: workId, pendingWorkName: workName })
  }

  handleCreateWorkAndAssign = workName => {
    db.createWork(workName).then(response => {
      this.setState({
        pendingWorkId: response.data.data._id,
        pendingWorkName: workName
      })
    })
  }

  async handleAccept() {
    const updateObject = {
      title: this.state.pendingTitle,
      text: this.state.pendingText,
      author: this.state.pendingAuthorId,
      work: this.state.pendingWorkId
    }

    this.setState({ edit: false, keep: true })
    await db
      .updateNoteInfo(this.props.id, updateObject)
      .then(this.props.refetchMe(this.props.index))
      .catch(error => {
        console.error(error)
      })
  }

  // FIXME: When a button is pressed in a note, tell the parent that I now should be inFocus

  render() {
    const { edit, id, addIdea, deleted } = this.state
    const inFocus = this.props.id == this.props.inFocus
    const note = this.props.note

    // Four possible states for a note:
    var mode = { name: 'Normal', class: 'normal ' }
    if (edit) {
      mode.name = 'Editing'
      mode.class = 'edit '
    } else if (addIdea) {
      mode.name = 'Editing Ideas'
      mode.class = 'edit-idea '
    } else if (inFocus) {
      mode.name = 'In Focus'
      mode.class = 'in-focus '
    }

    if (deleted) {
      return <div> </div>
    }

    // TODO: Do autocomplete's need their out ESC handling? Remove it.
    return (
      <div
        className={mode.class + 'note outer'}
        key={this.props.id}
        id={this.props.id}
        tabIndex={this.props.tabIndex}
      >
        <div className={mode.class + 'bar'}>
          {edit ? (
            <input
              className={'note title'}
              name="title"
              autoFocus
              defaultValue={this.state.pendingTitle}
              onChange={this.handleTitleChange}
            ></input>
          ) : !this.state.pendingTitle?.length ? (
            <div className={'note title'}>
              <em>Untitled Note</em>
            </div>
          ) : (
            <div className={mode.class + 'title'}>
              {this.state.pendingTitle}
            </div>
          )}
          {edit ? (
            <textarea
              className={'note text'}
              onChange={this.handleTextChange}
              value={note.text}
            ></textarea>
          ) : (
            <div className={'note text'}>{note.text}</div>
          )}
        </div>
        <div>
          {edit ? (
            <Autocomplete
              inputName={this.props.id + 'author'}
              dontAutofocus={true}
              className={'note author'}
              defaultValue={this.state.pendingAuthorName}
              escape={() => {
                this.setState({ edit: false })
              }}
              onSelect={this.handleUpdateAuthor}
              getSuggestions={db.getAuthorSuggestions}
              handleNewSelect={this.handleCreateAuthorAndAssign}
            />
          ) : (
            <div>
              <Link
                to={'/auth/' + this.state.pendingAuthorId}
                className={'note author label'}
              >
                {this.state.pendingAuthorName}
              </Link>
            </div>
          )}
        </div>
        <div>
          {edit ? (
            <Autocomplete
              inputName={this.props.id + 'work'}
              dontAutofocus={true}
              className={'note work'}
              defaultValue={this.state.pendingWorkName}
              escape={() => {
                this.setState({ edit: false })
              }}
              onSelect={this.handleUpdateWork.bind(this)}
              getSuggestions={db.getWorkSuggestions}
              handleNewSelect={this.handleCreateWorkAndAssign.bind(this)}
            />
          ) : (
            <div>
              <Link
                to={'/work/' + this.state.pendingWorkId}
                className={'note work label'}
              >
                {this.state.pendingWorkName}
              </Link>
              {this.state.pendingWorkId == note.work?._id ? (
                note.work?.url?.length ? (
                  <a href={note.work?.url}>
                    <img src={link} />
                  </a>
                ) : null
              ) : null}
            </div>
          )}
        </div>
        <div className={'note item-bottom'}>
          <div className={'container idea'}>
            <div>
              {note.ideas?.map(idea => (
                <Link to={'/idea/' + idea._id} key={'idea-link' + idea._id}>
                  <button
                    className={'idea label'}
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
            <div className={'container action-bar'}>
              <span>
                <button
                  className={'action-button'}
                  onClick={this.handleAccept.bind(this)}
                >
                  <img src={check_circle}></img>
                </button>

                <button
                  className={'action-button'}
                  onClick={this.handleCancel.bind(this)}
                >
                  <img src={cross_circle}></img>
                </button>
              </span>
            </div>
          ) : (
            <div className={'container action-bar'}>
              {this.state.addIdea ? (
                <Autocomplete
                  inputName={this.props.id + 'idea'}
                  className={'idea'}
                  clearOnSelect={true}
                  escape={() => {
                    this.setState({ addIdea: false })
                  }}
                  onSelect={this.handleNewTopic}
                  handleNewSelect={this.handleCreateTopicAndAssign}
                  getSuggestions={db.getIdeaSuggestions}
                />
              ) : (
                // Neither editing whole note nor ideas
                <span>
                  <button
                    className={'action-button'}
                    onClick={this.addIdea.bind(this)}
                    tabIndex="-1"
                  >
                    <img src={plus}></img>
                  </button>
                  <Link to={'/note/' + this.props.id}>
                    <button className={'action-button'} tabIndex="-1">
                      <img src={document_image}></img>
                    </button>
                  </Link>

                  <button
                    className={'action-button'}
                    onClick={this.handleEdit.bind(this)}
                    tabIndex="-1"
                  >
                    <img src={write}></img>
                  </button>
                  <button
                    onClick={this.handleDelete.bind(this)}
                    className={'action-button'}
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
