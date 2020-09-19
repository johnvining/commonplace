import React from 'react'
import { Link } from '@reach/router'
import { guessYearFromURL } from './utils'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import check_circle from './icons/check_circle.svg'
import cross_circle from './icons/cross_circle.svg'
import document_image from './icons/document.svg'
import ImageUploader from './ImageUploader'
import link from './icons/link.svg'
import tags from './icons/tags.svg'
import trash from './icons/trash.svg'
import write from './icons/write.svg'

class Note extends React.Component {
  state = {
    largeImage: -1,
    pendingAuthorId: null,
    pendingAuthorName: '',
    pendingCitation: '',
    pendingText: '',
    pendingTitle: '',
    pendingUrl: '',
    pendingWorkId: null,
    pendingWorkName: '',
    pendingYear: ''
  }

  componentDidMount() {
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)

    this.setState({
      inFocus: this.props.inFocus,
      pendingAuthorId: this.props.note.author?._id,
      pendingAuthorName: this.props.note.author?.name,
      pendingCitation: this.props.note.citation,
      pendingText: this.props.note.text,
      pendingTitle: this.props.note.title,
      pendingUrl: this.props.note.url,
      pendingWorkId: this.props.note.work?._id,
      pendingWorkName: this.props.note.work?.name,
      pendingYear: this.props.note.year
    })
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keyDownListener, false)
  }

  handleKeyDown(event) {
    // TODO: Update to pass in the status rather than the ID from parent
    if (this.props.inFocus != this.props.id) {
      return
    }
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

  handleCitationChange = val => {
    this.setState({ pendingCitation: val.target.value })
  }

  handleYearChange = val => {
    this.setState({ pendingYear: val.target.value })
  }

  handleTextChange = val => {
    this.setState({ pendingText: val.target.value })
  }

  handleUrlChange = val => {
    let year = guessYearFromURL(val.target.value)
    if (!this.state.pendingYear && year) {
      this.setState({ pendingUrl: val.target.value, pendingYear: year })
    } else {
      this.setState({ pendingUrl: val.target.value })
    }
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
      author: this.state.pendingAuthorId,
      citation: this.state.pendingCitation,
      text: this.state.pendingText,
      title: this.state.pendingTitle,
      url: this.state.pendingUrl,
      work: this.state.pendingWorkId
    }

    // TODO: Change to server-side validation, add client-side UI
    if (this.state.pendingYear < 2100 && this.state.pendingYear > -5000) {
      updateObject.year = this.state.pendingYear
    }

    this.setState({ edit: false, keep: true })
    await db
      .updateNoteInfo(this.props.id, updateObject)
      .then(this.props.refetchMe(this.props.index))
      .catch(error => {
        console.error(error)
      })
  }
  removeIdea(ideaId) {
    // TODO: Support passing the new version of a note back to parent instead of refetch
    db.removeIdeaFromNote(this.props.id, ideaId)
    this.props.refetchMe(this.props.index)
  }

  async onImageUpload(image) {
    await db.addImageToNote(this.props.id, image)

    // TODO: Don't fetch all the images if we don't need to
    this.props.getImagesForNoteAtIndex(this.props.index, true)
  }

  handleFocusImage(click) {
    this.setState({
      largeImage: click.target.id
    })
  }

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

    return (
      <div
        className={mode.class + 'note outer'}
        key={this.props.id}
        id={this.props.id}
        tabIndex={this.props.tabIndex}
      >
        {this.state.largeImage >= 0 ? (
          <div
            className="half"
            onClick={() => {
              this.setState({ largeImage: -1 })
            }}
          >
            <img
              className="large-image"
              src={URL.createObjectURL(
                this.props.note.imageBlobs[this.state.largeImage]
              )}
            />
          </div>
        ) : null}

        <div className={this.state.largeImage >= 0 ? 'half' : null}>
          <div className={mode.class + 'bar'}>
            {edit ? (
              <div>
                <input
                  className={'note title'}
                  name="title"
                  autoFocus
                  defaultValue={this.state.pendingTitle}
                  onChange={this.handleTitleChange}
                ></input>
                <input
                  className={'note year'}
                  name="year"
                  autoFocus
                  defaultValue={this.state.pendingYear}
                  onChange={this.handleYearChange}
                ></input>
              </div>
            ) : !this.state.pendingTitle?.length ? (
              <div className={'note title'}>
                <em>Untitled Note</em>
              </div>
            ) : (
              <div>
                <div className={mode.class + 'title'}>
                  {this.state.pendingTitle}
                </div>
                {this.state.pendingYear ? (
                  <div className={mode.class + 'year'}>
                    {this.state.pendingYear}
                  </div>
                ) : (
                  <div className={mode.class + 'year imputed'}>
                    {this.props.note.work?.year}
                  </div>
                )}
              </div>
            )}
            <div className="image-row">
              {this.props.note?.images?.map((image, index) => (
                <div
                  className={
                    this.state.largeImage == index
                      ? 'image-row image-frame selected'
                      : 'image-row image-frame'
                  }
                  key={this.props.id + index + 'div-img'}
                  onClick={this.handleFocusImage.bind(this)}
                  id={index}
                >
                  {this.props.note?.imageBlobs ? (
                    <img
                      key={this.props.id + index + 'img'}
                      src={URL.createObjectURL(
                        this.props.note.imageBlobs[index]
                      )}
                      className="image-row"
                      id={index}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            {edit ? (
              <>
                <textarea
                  className={'note text'}
                  onChange={this.handleTextChange}
                  value={this.state.pendingText}
                ></textarea>
                <input
                  className={'note citation'}
                  name="citation"
                  defaultValue={this.state.pendingCitation}
                  onChange={this.handleCitationChange}
                ></input>
              </>
            ) : (
              <div className={'note text'}>{this.state.pendingText}</div>
            )}
          </div>
          <div>
            {edit ? (
              <input
                className={'note url'}
                name="url"
                defaultValue={this.state.pendingUrl}
                onChange={this.handleUrlChange}
              ></input>
            ) : (
              <span className={'note url'}>
                <a href={this.state.pendingUrl}>{this.state.pendingUrl}</a>
              </span>
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
                {this.state.pendingAuthorName ? (
                  <Link
                    to={'/auth/' + this.state.pendingAuthorId}
                    className={'note author label'}
                  >
                    {this.state.pendingAuthorName}
                  </Link>
                ) : (
                  <Link
                    to={'/auth/' + this.props.note?.work?.author?._id}
                    className={'note author label imputed'}
                  >
                    {this.props.note?.work?.author?.name}
                  </Link>
                )}
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
                  {this.state.pendingCitation ? (
                    <>, {this.state.pendingCitation}</>
                  ) : null}
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
                {note.ideas?.map(idea =>
                  this.state.addIdea ? (
                    <button
                      className="idea label edit"
                      key={'idea-button' + idea._id}
                      tabIndex="-1"
                      onClick={() => {
                        this.removeIdea(idea._id)
                      }}
                    >
                      {idea.name}
                    </button>
                  ) : (
                    <Link to={'/idea/' + idea._id} key={'idea-link' + idea._id}>
                      <button
                        className="idea label"
                        key={'idea-button' + idea._id}
                        tabIndex="-1"
                      >
                        {idea.name}
                      </button>
                    </Link>
                  )
                )}
              </div>
            </div>

            {edit ? (
              <div className={'container action-bar'}>
                <div>
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
                </div>
                <div className={'container action-bar'}>
                  <ImageUploader
                    onImageUpload={this.onImageUpload.bind(this)}
                  />
                </div>
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
                      <img src={tags}></img>
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
      </div>
    )
  }
}

export default Note
