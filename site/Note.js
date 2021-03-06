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
import PileListForItem from './PileListForItem'
import * as constants from './constants'
import autosize from 'autosize'

class Note extends React.Component {
  state = {
    largeImage: -1,
    pendingAuthorId: null,
    pendingAuthorName: '',
    pendingPage: '',
    pendingTake: '',
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
      pendingAuthorId: this.props.note.author?._id,
      pendingAuthorName: this.props.note.author?.name,
      pendingPage: this.props.note.page,
      pendingTake: this.props.note.take,
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
    if (
      this.props.mode == constants.note_modes.EDIT &&
      event.ctrlKey &&
      event.keyCode == 65
    ) {
      this.handleAccept()
    } else if (this.state.edit && event.keyCode == 27) {
      this.props.setNoteMode('', '')
    }
  }

  handleDelete() {
    if (confirm('Are you sure you want to delete this note?')) {
      db.deleteRecord(db.types.note, this.props.id)
        .then(() => {
          this.setState({ deleted: true })
        })
        .catch(error => {
          console.error(error)
        })
    }
  }

  handleTitleChange = val => {
    this.setState({ pendingTitle: val.target.value })
  }

  handlePageChange = val => {
    this.setState({ pendingPage: val.target.value })
  }

  handleYearChange = val => {
    this.setState({ pendingYear: val.target.value })
  }

  handleTextChange = val => {
    autosize(document.querySelector('#text'))
    this.setState({ pendingText: val.target.value })
  }

  handleTakeChange = val => {
    autosize(document.querySelector('#take'))
    this.setState({ pendingTake: val.target.value })
  }

  handleUrlChange = val => {
    var year = guessYearFromURL(val.target.value)
    if (!this.state.pendingYear && year) {
      this.setState({ pendingUrl: val.target.value, pendingYear: year })
    } else {
      this.setState({ pendingUrl: val.target.value })
    }
  }

  handleNewIdea = ideaId => {
    db.addLinkToRecord(db.types.idea, ideaId, db.types.note, this.props.id)
      .then(() => {
        this.props.refetchMe(this.props.index)
      })
      .catch(e => {
        console.error(e)
      })
  }

  // TODO: Clear entry after assignment
  handleCreateIdeaAndAddToNote = ideaName => {
    db.createAndLinkToRecord(
      db.types.idea,
      ideaName,
      db.types.note,
      this.props.id
    )
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
    db.createRecord(db.types.auth, authorName).then(response => {
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
    db.createRecord(db.types.work, workName).then(response => {
      this.setState({
        pendingWorkId: response.data.data._id,
        pendingWorkName: workName
      })
    })
  }

  async handleAccept() {
    const updateObject = {
      author: this.state.pendingAuthorId,
      page: this.state.pendingPage,
      take: this.state.pendingTake,
      text: this.state.pendingText,
      title: this.state.pendingTitle,
      url: this.state.pendingUrl,
      work: this.state.pendingWorkId
    }

    // TODO: Change to server-side validation, add client-side UI
    if (this.state.pendingYear < 2100 && this.state.pendingYear > -5000) {
      updateObject.year = this.state.pendingYear
    }

    this.setState({ keep: true })
    this.props.setNoteMode(constants.note_modes.SELECT)
    await db
      .updateRecord(db.types.note, this.props.id, updateObject)
      .then(this.props.refetchMe(this.props.index))
      .catch(error => {
        console.error(error)
      })
  }

  removeIdea(ideaId) {
    // TODO: Support passing the new version of a note back to parent instead of refetch
    db.removeFromRecord(db.types.idea, ideaId, db.types.note, this.props.id)
    this.props.refetchMe(this.props.index)
  }

  async onImageUpload(image) {
    await db.addImageToNote(this.props.id, image)

    // TODO: Don't fetch all the images if we don't need to, e.g. views that won't show them
    this.props.getImagesForNoteAtIndex(this.props.index, true)
  }

  handleFocusImage(click) {
    if (
      this.props.mode == constants.note_modes.EDIT &&
      confirm('Are you sure you want to delete this image?')
    ) {
      if (click.target.id == this.state.largeImage) {
        this.setState({ largeImage: -1 })
      }
      db.deleteImage(
        this.props.id,
        this.props.note.images[click.target.id]
      ).then(() => {
        // TODO: Update refetchMe to handle a response from the database if we've already gotten it
        this.props.getImagesForNoteAtIndex(this.props.index, true)
      })
    } else {
      this.setState({
        largeImage: click.target.id
      })
    }
  }

  async handleNewPile(pile) {
    db.addLinkToRecord(db.types.pile, pile, db.types.note, this.props.id).then(
      () => {
        this.props.refetchMe(this.props.index)
      }
    )
  }

  async handleCreatePileAndAssign(pileName) {
    db.createAndLinkToRecord(
      db.types.pile,
      pileName,
      db.types.note,
      this.props.id
    ).then(() => {
      this.props.refetchMe(this.props.index)
    })
  }

  async handlePileRemove(pileId) {
    db.removeFromRecord(
      db.types.pile,
      pileId,
      db.types.note,
      this.props.id
    ).then(() => {
      this.props.refetchMe(this.props.index)
    })
  }

  async handleClearAuthor() {
    this.setState({ pendingAuthorId: null, pendingAuthorName: '' })
  }

  async handleClearWork() {
    this.setState({ pendingWorkId: null, pendingWorkName: '' })
  }

  render() {
    const { deleted } = this.state
    const { note } = this.props

    if (deleted) {
      return <div> </div>
    }

    var edit = false,
      edit_ideas = false,
      edit_piles = false,
      selected = false,
      no_selection = false

    var class_name = 'note-full '
    switch (this.props.mode) {
      case constants.note_modes.NO_SELECTION:
        no_selection = true
        break
      case constants.note_modes.NOT_SELECTED:
        class_name = 'note-full not-selected '
        break
      case constants.note_modes.SELECTED:
        selected = true
        class_name = 'note-full selected '
        break
      case constants.note_modes.EDIT:
        class_name = 'note-full edit-note '
        edit = true
        break
      case constants.note_modes.EDIT_IDEAS:
        class_name = 'note-full edit-note '
        edit_ideas = true
        break
      case constants.note_modes.EDIT_PILES:
        class_name = 'note-full edit-note '
        edit_piles = true
        break
    }

    return (
      <div
        className={class_name + 'outer'}
        key={this.props.id}
        id={this.props.id}
        tabIndex={no_selection ? this.props.tabIndex : '-1'}
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
              src={this.props.note.imageUrls[this.state.largeImage]}
            />
          </div>
        ) : null}
        <div className={this.state.largeImage >= 0 ? 'half' : null}>
          <div>
            {/* Title and Year */}
            <div className="note-full left-right-bar">
              {edit ? (
                <div className="width-80">
                  <label htmlFor="title" className="note-full form-label">
                    Title
                  </label>
                  <input
                    id="title"
                    className="note-full title input"
                    autoFocus
                    defaultValue={this.state.pendingTitle}
                    onChange={this.handleTitleChange}
                  ></input>
                </div>
              ) : (
                <div className="note-full title">{this.state.pendingTitle}</div>
              )}
              {edit ? (
                <div className="width-20">
                  <label htmlFor="year" className="note-full form-label">
                    Year
                  </label>
                  <input
                    id="year"
                    className="note-full year input"
                    defaultValue={this.state.pendingYear}
                    onChange={this.handleYearChange}
                  ></input>
                </div>
              ) : this.state.pendingYear ? (
                <div className="note-full year">{this.state.pendingYear}</div>
              ) : (
                <div className="note-full year imputed">
                  {this.props.note.work?.year}
                </div>
              )}
            </div>
            {/* Piles */}
            <div className="note-full pile container">
              <PileListForItem
                remove={this.state.edit}
                allowTabbing={selected || edit_piles}
                allowAdd={selected || edit_piles || no_selection}
                edit={edit_piles}
                piles={note.piles}
                onSelect={this.handleNewPile.bind(this)}
                getSuggestions={db.getSuggestions}
                apiType={db.types.pile}
                handleNewSelect={this.handleCreatePileAndAssign.bind(this)}
                mainClassName="note"
                onPileRemove={this.handlePileRemove.bind(this)}
                onStartPileEdit={() => {
                  this.props.onStartPileEdit(note._id)
                }}
              />
            </div>
            {/* Images */}
            <div className="note-full image-row">
              {this.props.note?.images?.map((image, index) => (
                <div
                  className={
                    this.state.edit
                      ? 'image-row image-frame remove'
                      : this.state.largeImage == index
                      ? 'image-row image-frame selected'
                      : 'image-row image-frame'
                  }
                  key={this.props.id + index + 'div-img'}
                  onClick={this.handleFocusImage.bind(this)}
                  id={index}
                >
                  {this.props.note?.imageUrls ? (
                    <img
                      key={this.props.id + index + 'img'}
                      src={this.props.note.imageUrls[index]}
                      className="image-row"
                      id={index}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            {/* Text area */}
            <div name="text">
              {edit ? (
                <>
                  <label htmlFor="text" className="note-full form-label">
                    Text
                  </label>
                  <textarea
                    id="text"
                    className={'note-full note-text edit'}
                    onChange={this.handleTextChange}
                    value={this.state.pendingText}
                  ></textarea>
                </>
              ) : (
                <div className={'note-full note-text'}>
                  {this.state.pendingText}
                </div>
              )}
            </div>
            {/* Take */}
            <div name="take">
              {edit ? (
                <>
                  <label htmlFor="take" className="note-full form-label">
                    Take
                  </label>
                  <textarea
                    id="take"
                    className={'note-full note-take edit'}
                    onChange={this.handleTakeChange}
                    value={this.state.pendingTake}
                  ></textarea>
                </>
              ) : this.state.pendingTake ? (
                <div className="note-full note-take">
                  {this.state.pendingTake}
                </div>
              ) : null}
            </div>

            {/* Author */}
            <div name="author">
              {edit ? (
                <>
                  <label htmlFor="author" className="note-full form-label">
                    Author
                  </label>
                  <Autocomplete
                    className={'note-full author'}
                    defaultValue={this.state.pendingAuthorName || ''}
                    dontAutofocus={true}
                    inputName={this.props.id + 'author'}
                    onSelect={this.handleUpdateAuthor}
                    getSuggestions={db.getSuggestions}
                    apiType={db.types.auth}
                    handleNewSelect={this.handleCreateAuthorAndAssign}
                    onClearText={this.handleClearAuthor.bind(this)}
                  />
                </>
              ) : (
                <div>
                  {this.state.pendingAuthorName ? (
                    <Link
                      to={'/auth/' + this.state.pendingAuthorId}
                      className={'note-full author label'}
                    >
                      {this.state.pendingAuthorName}
                    </Link>
                  ) : this.props.note?.work?.author ? (
                    <Link
                      to={'/auth/' + this.props.note?.work?.author?._id}
                      className={'note-full author label imputed'}
                    >
                      {this.props.note?.work?.author?.name}
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
            {/* Work */}
            <div>
              {edit ? (
                <>
                  <label htmlFor="work" className="note-full form-label">
                    Work
                  </label>
                  <Autocomplete
                    inputName={this.props.id + 'work'}
                    dontAutofocus={true}
                    className={'note-full work edit'}
                    defaultValue={this.state.pendingWorkName || ''}
                    onSelect={this.handleUpdateWork.bind(this)}
                    getSuggestions={db.getSuggestions}
                    apiType={db.types.work}
                    handleNewSelect={this.handleCreateWorkAndAssign.bind(this)}
                    onClearText={this.handleClearWork.bind(this)}
                  />
                </>
              ) : this.state.pendingWorkId ? (
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
              ) : null}
            </div>
            {/* URL and Page */}
            <div className={'left-right-bar'}>
              {edit ? (
                <div className="width-80">
                  <label htmlFor="url" className="note-full form-label">
                    URL
                  </label>
                  <input
                    id="url"
                    className={'note-full url input'}
                    name="url"
                    defaultValue={this.state.pendingUrl}
                    onChange={this.handleUrlChange}
                  ></input>
                </div>
              ) : (
                <span className={'note-full url'}>
                  <a href={this.state.pendingUrl}>{this.state.pendingUrl}</a>
                </span>
              )}
              {edit ? (
                <div className="width-20">
                  <label htmlFor="page" className="note-full form-label">
                    Page
                  </label>
                  <input
                    id="page"
                    className={'note-full page input'}
                    name="url"
                    defaultValue={this.state.pendingPage}
                    onChange={this.handlePageChange}
                  ></input>
                </div>
              ) : (
                <span className={'note-full page'}>
                  <a href={this.state.pendingPage}>{this.state.pendingPage}</a>
                </span>
              )}
            </div>
            {/* Ideas and Action bar */}
            <div className={'left-right-bar'}>
              <div className={'idea-container'}>
                {note.ideas?.map(idea =>
                  edit_ideas ? (
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
              <div className={'action-bar'}>
                {edit ? (
                  <>
                    <div>
                      <button
                        className={'action-button'}
                        onClick={this.handleAccept.bind(this)}
                      >
                        <img src={check_circle}></img>
                      </button>

                      <button
                        className={'action-button'}
                        onClick={() => {
                          this.props.setNoteMode(this.props.id, '')
                        }}
                      >
                        <img src={cross_circle}></img>
                      </button>
                    </div>
                    <div className={'container action-bar'}>
                      <ImageUploader
                        onImageUpload={this.onImageUpload.bind(this)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {edit_ideas ? (
                      <Autocomplete
                        inputName={this.props.id + 'idea'}
                        className={'idea'}
                        clearOnSelect={true}
                        escape={() => {
                          this.setState({ addIdea: false })
                        }}
                        onSelect={this.handleNewIdea}
                        handleNewSelect={this.handleCreateIdeaAndAddToNote}
                        getSuggestions={db.getSuggestions}
                        apiType={db.types.idea}
                        excludeIds={note.ideas.map(idea => idea._id)}
                      />
                    ) : (
                      // Neither editing whole note nor ideas
                      <span>
                        <button
                          className={'action-button'}
                          onClick={() => {
                            this.props.setNoteMode(
                              this.props.id,
                              constants.note_modes.EDIT_IDEAS
                            )
                          }}
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
                          onClick={() => {
                            this.props.setNoteMode(
                              this.props.id,
                              constants.note_modes.EDIT
                            )
                          }}
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Note
