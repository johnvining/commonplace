import React from 'react'
import { Link } from 'react-router-dom'
import { guessYearFromURL } from './utils'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import check_circle from 'url:./icons/check_circle.svg'
import cross_circle from 'url:./icons/cross_circle.svg'
// import clipboard from 'url:./icons/clipboard.svg'
// import clipboard_check from 'url:./icons/clipboard_check.svg'
import document_image from 'url:./icons/document.svg'
import left_arrow from 'url:./icons/left.svg'
import right_arrow from 'url:./icons/right.svg'
import ImageUploader from './ImageUploader'
import tags from 'url:./icons/tags.svg'
import eye from 'url:./icons/eye.svg'
import eye_closed from 'url:./icons/eye_closed.svg'
import pile_img from 'url:./icons/stack.svg'
import trash from 'url:./icons/trash.svg'
import write from 'url:./icons/write.svg'
import link from 'url:./icons/link.svg'
import PileListForItem from './PileListForItem'
import * as constants from './constants'
import autosize from 'autosize'
import YearUrlComboSpan from './YearUrlComboSpan'
import WorkCitationSpan from './WorkCitationSpan'
import { renderMarkdown } from './safeMarkdown'
import ClickToCopyNick from './ClickToCopyNick'
import ClickableLabelButton from './ClickableLabelButton'
import { useKeyboardShortcuts, shortcuts } from './KeyboardContext'
import { togglePinned } from './pinned'
import PinButton from './PinButton'

class Note extends React.Component<any, any> {
  state: any = {
    largeImage: -1,
    lightboxOpen: false,
    overlayMode: false,
    focusEdit: false,
    pendingAuthorId: null,
    pendingAuthorName: '',
    pendingPage: '',
    pendingTake: '',
    pendingText: '',
    pendingTitle: '',
    pendingUrl: '',
    pendingWorkId: null,
    pendingWorkName: '',
    pendingYear: '',
    fetchingTitleSuggestion: false,
    suggestedTags: [],
    fetchNick: false,
    fetchingOcr: false,
    nick: '',
    compactEdit: true,
    linkToAdd: '',
    linkedNotes: {},
  }

  _beforeUnloadHandler = (e: any) => {
    e.preventDefault()
    e.returnValue = ''
  }

  isInEditMode() {
    return [
      constants.note_modes.EDIT,
      constants.note_modes.EDIT_IDEAS,
      constants.note_modes.EDIT_PILES,
      constants.note_modes.EDIT_LINKS,
    ].includes(this.props.mode)
  }

  componentDidUpdate(prevProps: any) {
    const wasEditing = [
      constants.note_modes.EDIT,
      constants.note_modes.EDIT_IDEAS,
      constants.note_modes.EDIT_PILES,
      constants.note_modes.EDIT_LINKS,
    ].includes(prevProps.mode)
    const isEditing = this.isInEditMode()
    if (!wasEditing && isEditing) {
      window.addEventListener('beforeunload', this._beforeUnloadHandler)
    } else if (wasEditing && !isEditing) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler)
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this._beforeUnloadHandler)
  }

  componentDidMount() {
    if (this.props.note.nick) {
      this.setState({ nick: this.props.note.nick })
    } else {
      db.getNoteNick(this.props.id).then((response: any) => {
        this.setState({ nick: response.data.data.key })
      })
    }

    this.fetchLinkedNotes()

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
      pendingYear: this.props.note.year,
    })

    if (this.props.mode == constants.note_modes.EDIT_LINKS) {
      document.getElementById('linkInput')?.focus()
    }
  }

  // Section 5: Note Editing keyboard shortcuts - called from wrapper
  handleKeyboardShortcut(event: any) {
    const selected = this.props.mode === constants.note_modes.SELECTED
    const editMode = this.props.mode === constants.note_modes.EDIT
    const editIdeas = this.props.mode === constants.note_modes.EDIT_IDEAS
    const editPiles = this.props.mode === constants.note_modes.EDIT_PILES
    const editLinks = this.props.mode === constants.note_modes.EDIT_LINKS
    const anyEditMode = editMode || editIdeas || editPiles || editLinks

    // Only handle if this note is selected or in edit mode
    if (!selected && !anyEditMode) {
      return false
    }

    // Close lightbox, focusEdit, or overlay with Escape
    if (event.keyCode === constants.keyCodes.esc) {
      if (this.state.lightboxOpen) { this.setState({ lightboxOpen: false }); return true }
      if (this.state.focusEdit) { this.setState({ focusEdit: false }); return true }
      if (this.state.overlayMode) { this.setState({ overlayMode: false, largeImage: -1 }); return true }
    }

    // Section 5.1: Save and Exit
    if (shortcuts.note.exitEdit(event) && anyEditMode) {
      this.props.setNoteMode(this.props.id, constants.note_modes.SELECTED)
      return true
    }

    if (shortcuts.note.star(event) && selected && !anyEditMode) {
      this.toggleStar()
      return true
    }

    if (shortcuts.note.save(event) && anyEditMode) {
      this.handleAccept()
      return true
    }

    if (shortcuts.note.editLinks(event) && selected && !anyEditMode) {
      this.props.setNoteMode(this.props.id, constants.note_modes.EDIT_LINKS)
      return true
    }

    // Section 5.4: Note Links Mode
    if (shortcuts.note.addLink(event) && editLinks) {
      this.handleNewNoteLink()
      return true
    }

    // Section 5.3: Image Navigation (works in selected or edit modes)
    if (shortcuts.note.toggleImage(event)) {
      this.toggleFocusImage()
      return true
    }
    if (shortcuts.note.prevImage(event)) {
      this.moveFocusedImage(-1)
      return true
    }
    if (shortcuts.note.nextImage(event)) {
      this.moveFocusedImage(1)
      return true
    }

    // Section 5.2: Text Tools (Edit mode only)
    if (editMode) {
      if (shortcuts.note.format(event)) {
        this.formatMainText()
        return true
      }
      if (shortcuts.note.suggestTitle(event)) {
        this.generateTitleSuggestion()
        return true
      }
      if (shortcuts.note.ocr(event)) {
        this.runOCROnText()
        return true
      }
    }

    return false
  }

  getNoteLabel() {
    if (this.state.pendingTitle?.trim()?.length) {
      return this.state.pendingTitle
    }
    if (this.state.pendingText?.trim()?.length) {
      const trimmed = this.state.pendingText.trim()
      return `${trimmed.slice(0, 80)}${trimmed.length > 80 ? '...' : ''}`
    }
    return 'Untitled Note'
  }

  toggleStar() {
    togglePinned({
      type: 'note',
      id: this.props.id,
      label: this.getNoteLabel(),
      href: `/note/${this.props.id}`,
    })
  }

  handleSelectKeyDown = (event: any) => {
    if (event.keyCode !== constants.keyCodes.enter) {
      return
    }

    if (
      this.props.mode === constants.note_modes.NO_SELECTION ||
      this.props.mode === constants.note_modes.NOT_SELECTED
    ) {
      this.props.setNoteMode(this.props.id, constants.note_modes.SELECTED)
      event.preventDefault()
      event.stopPropagation()
    }
  }

  formatMainText() {
    let originalText = this.state.pendingText
    let newText = originalText.replaceAll('\n', ' ').replaceAll('  ', ' ')
    this.setState({ pendingText: newText })
  }

  handleDelete() {
    if (confirm('Are you sure you want to delete this note?')) {
      db.deleteRecord(db.types.note, this.props.id)
        .then(() => {
          this.setState({ deleted: true })
        })
        .catch((error: any) => {
          console.error(error)
        })
    }
  }

  handleTitleChange = (val: any) => {
    this.setState({ pendingTitle: val.target.value })
  }

  handlePageChange = (val: any) => {
    this.setState({ pendingPage: val.target.value })
  }

  handleYearChange = (val: any) => {
    this.setState({ pendingYear: val.target.value })
  }

  handleTextChange = (val: any) => {
    autosize(document.querySelector('#text') as HTMLElement)
    this.setState({ pendingText: val.target.value })
  }

  handleTakeChange = (val: any) => {
    autosize(document.querySelector('#take') as HTMLElement)
    this.setState({ pendingTake: val.target.value })
  }

  handleUrlChange = (val: any) => {
    var year = guessYearFromURL(val.target.value)
    if (!this.state.pendingYear && year) {
      this.setState({ pendingUrl: val.target.value, pendingYear: year })
    } else {
      this.setState({ pendingUrl: val.target.value })
    }
  }

  fetchLinkedNotes() {
    db.getLinkedNotes(this.props.id).then((response: any) => {
      const entries = response.data.data.map((note: any) => [note._id, note.nick])
      this.setState({ linkedNotes: Object.fromEntries(entries) })
    })
  }

  // TODO: Clear entry after assignment
  handleCreateIdeaAndAddToNote = (ideaName: any) => {
    db.createAndLinkToRecord(
      db.types.idea,
      ideaName,
      db.types.note,
      this.props.id
    )
      .then(() => {
        this.props.refetchMe(this.props.index)
      })
      .catch((e: any) => {
        console.error(e)
      })
  }

  handleCreatePileAndAssign(pileName: any) {
    db.createAndLinkToRecord(
      db.types.pile,
      pileName,
      db.types.note,
      this.props.id
    )
      .then(() => {
        this.props.refetchMe(this.props.index)
      })
      .catch((e: any) => {
        console.error(e)
      })
  }

  handleUpdateAuthor = (authorId: any, authorName: any) => {
    this.setState({ pendingAuthorName: authorName, pendingAuthorId: authorId })
  }

  handleCreateAuthorAndAssign = (authorName: any) => {
    db.createRecord(db.types.auth, authorName).then((response: any) => {
      this.setState({
        pendingAuthorId: response.data.data._id,
        pendingAuthorName: authorName,
      })
    })
  }

  handleUpdateWork = (workId: any, workName: any) => {
    this.setState({ pendingWorkId: workId, pendingWorkName: workName })
  }

  handleCreateWorkAndAssign = (workName: any) => {
    db.createRecord(db.types.work, workName).then((response: any) => {
      this.setState({
        pendingWorkId: response.data.data._id,
        pendingWorkName: workName,
      })
    })
  }

  async handleAccept() {
    const updateObject: any = {
      author: this.state.pendingAuthorId,
      page: this.state.pendingPage,
      take: this.state.pendingTake,
      text: this.state.pendingText,
      title: this.state.pendingTitle,
      url: this.state.pendingUrl,
      work: this.state.pendingWorkId,
    }

    // TODO: Change to server-side validation, add client-side UI
    if (this.state.pendingYear < 2100 && this.state.pendingYear > -5000) {
      updateObject.year = this.state.pendingYear
    }

    this.setState({ keep: true })
    const previousMode = this.props.mode
    this.props.setNoteMode(this.props.id, constants.note_modes.SELECTED)
    try {
      await db.updateRecord(db.types.note, this.props.id, updateObject)
      this.props.refetchMe(this.props.index)
    } catch (error) {
      // Stay in edit mode so the user can retry; the axios interceptor
      // already surfaces a toast with the server message. Dev-only log is
      // a safety net for when the interceptor is bypassed.
      this.props.setNoteMode(this.props.id, previousMode)
      if (process.env.NODE_ENV === 'development') console.error(error)
    }
  }

  async handleNewNoteLink() {
    // TODO: Add refetching
    await db.addNoteLinkToNote(this.state.nick, this.state.linkToAdd)
    this.fetchLinkedNotes()
    this.setState({ linkToAdd: '' })
  }

  async toggleCompact() {
    this.setState({ compactEdit: !this.state.compactEdit })
  }

  removeIdea(ideaId: any) {
    // TODO: Support passing the new version of a note back to parent instead of refetch
    db.removeFromRecord(db.types.idea, ideaId, db.types.note, this.props.id)
    this.props.refetchMe(this.props.index)
  }

  async generateTitleSuggestion() {
    this.setState({ fetchingTitleSuggestion: true })
    await db.getTitleSuggestion(this.props.id).then((response: any) => {
      this.setState({
        pendingTitle: response.data.suggested_title,
        fetchingTitleSuggestion: false,
      })
    })
  }

  async runOCROnText() {
    this.setState({ fetchingOcr: true })
    db.getNoteTextOCR(this.props.id).then((response: any) => {
      const newText = response.data.data
      this.setState({
        pendingText: newText,
        fetchingOcr: false,
      })
      const input = document.querySelector('#text')

      const event = new Event('input', { bubbles: true })
      input?.dispatchEvent(event)
      this.handleTextChange
    })
  }

  handleSuggestedIdeas() {
    return db.getIdeaSuggestions(this.props.id)
  }

  async onImageUpload(image: any) {
    await db.addImageToNote(this.props.id, image)
    this.props.getImagesForNoteAtIndex(this.props.index, true)
  }

  handleFocusImage(index: any) {
    if (this.isInEditMode()) {
      this.setState({ largeImage: index, focusEdit: true, lightboxOpen: false, overlayMode: false })
    } else {
      this.setState({ largeImage: index, lightboxOpen: false, overlayMode: true })
    }
  }

  handleDeleteImage(index: any) {
    if (!confirm('Delete this image?')) return
    if (index === this.state.largeImage) this.setState({ largeImage: -1 })
    db.deleteImage(this.props.id, this.props.note.images[index]).then(() => {
      this.props.getImagesForNoteAtIndex(this.props.index, true)
    })
  }

  toggleFocusImage() {
    if (this.state.lightboxOpen) {
      this.setState({ lightboxOpen: false })
    } else if (this.state.overlayMode) {
      this.setState({ overlayMode: false, largeImage: -1 })
    } else if (this.props.note.imageUrls?.length > 0) {
      this.setState({ overlayMode: true, largeImage: 0 })
    }
  }

  moveFocusedImage(val: any) {
    const urls = this.props.note.imageUrls
    if (this.state.largeImage < 0 || !urls?.length) return
    const newVal = this.state.largeImage + val
    if (newVal < 0 || newVal >= urls.length) return
    this.setState({ largeImage: newVal })
  }

  handleNewPile = (pileId: any) => {
    db.addLinkToRecord(db.types.pile, pileId, db.types.note, this.props.id)
      .then(() => {
        this.props.refetchMe(this.props.index)
      })
      .catch((e: any) => {
        console.error(e)
      })
  }

  handleNewIdea = (ideaId: any) => {
    db.addLinkToRecord(db.types.idea, ideaId, db.types.note, this.props.id)
      .then(() => {
        this.props.refetchMe(this.props.index)
      })
      .catch((e: any) => {
        console.error(e)
      })
  }

  async handlePileRemove(pileId: any) {
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

    const noteLabel = this.getNoteLabel()

    var edit = false,
      edit_ideas = false,
      edit_piles = false,
      selected = false,
      no_selection = false,
      not_selected = false,
      edit_links = false

    var class_name = 'note-full '
    switch (this.props.mode) {
      case constants.note_modes.NO_SELECTION:
        no_selection = true
        break
      case constants.note_modes.NOT_SELECTED:
        not_selected = true
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
      case constants.note_modes.EDIT_LINKS:
        class_name = 'note-full edit-note '
        edit_links = true
        break
    }

    return (
      <div
        className={
          class_name +
          'outer' +
          ''
        }
        key={this.props.id}
        id={this.props.id}
        data-note-id={this.props.id}
        tabIndex={no_selection || not_selected ? this.props.tabIndex : '-1'}
        onKeyDown={this.handleSelectKeyDown}
      >

        {this.state.lightboxOpen && this.state.largeImage >= 0 ? (
          <div className="lightbox-backdrop" onClick={() => this.setState({ lightboxOpen: false })}>
            <div className="lightbox-content" onClick={e => e.stopPropagation()}>
              {this.props.note.imageUrls.length > 1 && (
                <button
                  className="lightbox-nav lightbox-prev"
                  onClick={() => this.moveFocusedImage(-1)}
                  disabled={this.state.largeImage === 0}
                >‹</button>
              )}
              <img
                className="lightbox-image"
                src={this.props.note.imageUrls[this.state.largeImage]}
              />
              {this.props.note.imageUrls.length > 1 && (
                <button
                  className="lightbox-nav lightbox-next"
                  onClick={() => this.moveFocusedImage(1)}
                  disabled={this.state.largeImage === this.props.note.imageUrls.length - 1}
                >›</button>
              )}
              <button className="lightbox-close" onClick={() => this.setState({ lightboxOpen: false })}>×</button>
              {this.props.note.imageUrls.length > 1 && (
                <div className="lightbox-counter">
                  {this.state.largeImage + 1} / {this.props.note.imageUrls.length}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {this.state.focusEdit && this.state.largeImage >= 0 && this.props.note.imageUrls?.length > 0 ? (
          <div className="focus-edit-backdrop" onClick={() => this.setState({ focusEdit: false })}>
            <div className="focus-edit-panel" onClick={e => e.stopPropagation()}>
              <div className="focus-edit-image-side">
                {this.props.note.imageUrls.length > 1 && (
                  <button
                    className="lightbox-nav lightbox-prev"
                    onClick={() => this.moveFocusedImage(-1)}
                    disabled={this.state.largeImage === 0}
                  >‹</button>
                )}
                <img
                  className="focus-edit-image"
                  src={this.props.note.imageUrls[this.state.largeImage]}
                />
                {this.props.note.imageUrls.length > 1 && (
                  <button
                    className="lightbox-nav lightbox-next"
                    onClick={() => this.moveFocusedImage(1)}
                    disabled={this.state.largeImage === this.props.note.imageUrls.length - 1}
                  >›</button>
                )}
              </div>
              <div className="focus-edit-text-side">
                <button className="focus-edit-close" onClick={() => this.setState({ focusEdit: false })}>×</button>
                <label className="note-full form-label">
                  Text
                  <ClickableLabelButton onClick={() => this.runOCROnText()}>
                    {this.state.fetchingOcr ? 'Fetching' : 'OCR'}
                  </ClickableLabelButton>
                  <ClickableLabelButton onClick={() => this.formatMainText()}>Format</ClickableLabelButton>
                </label>
                <textarea
                  className="focus-edit-textarea"
                  value={this.state.pendingText}
                  onChange={this.handleTextChange}
                  autoFocus
                />
                <label className="note-full form-label" style={{ marginTop: 8 }}>Take</label>
                <textarea
                  className="focus-edit-textarea"
                  value={this.state.pendingTake}
                  onChange={this.handleTakeChange}
                />
                <button
                  className="button focus-edit-save"
                  onClick={() => { this.handleAccept(); this.setState({ focusEdit: false }) }}
                >
                  <img src={check_circle} /> Save
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="full-width">
          {/* Title */}
          {edit ? (
            <>
              <div className="width-100">
                <label htmlFor="title" className="note-full form-label">
                  Title
                  <ClickableLabelButton
                    onClick={() => {
                      this.generateTitleSuggestion()
                    }}
                  >
                    {this.state.fetchingTitleSuggestion
                      ? 'Fetching'
                      : 'Suggest'}
                  </ClickableLabelButton>
                </label>

                <input
                  id="title"
                  className="note-full title input edit"
                  autoFocus
                  value={this.state.pendingTitle}
                  onChange={this.handleTitleChange}
                ></input>
              </div>
            </>
          ) : this.state.pendingTitle ? (
            <div className="width-100">
              <div className="note-full title">{this.state.pendingTitle}</div>
            </div>
          ) : null}

          {/* Images */}
          {this.props.note?.images?.length > 0 ? (
            <div className="note-full image-row width-100" style={{ alignItems: 'center' }}>
              {this.props.note?.images?.map((image: any, index: any) => (
                <div
                  className={`image-row image-frame${this.state.largeImage == index ? ' selected' : ''}`}
                  key={this.props.id + index + 'div-img'}
                  onClick={() => this.handleFocusImage(index)}
                >
                  {this.props.note.imageUrls ? (
                    <img
                      key={this.props.id + index + 'img'}
                      src={this.props.note.imageUrls[index]}
                      className="image-row"
                      loading="lazy"
                    />
                  ) : null}
                  {edit ? (
                    <button
                      className="image-delete-btn"
                      onClick={(e: any) => { e.stopPropagation(); this.handleDeleteImage(index) }}
                      title="Delete image"
                    >×</button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* Overlay mode */}
          {this.state.overlayMode && !edit && this.props.note.imageUrls?.length > 0 && this.state.largeImage >= 0 ? (
            <div className="note-overlay-wrapper width-100" onClick={() => this.setState({ lightboxOpen: true })}>
              <button
                className="overlay-close-btn"
                onClick={(e: any) => { e.stopPropagation(); this.setState({ overlayMode: false, largeImage: -1 }) }}
                title="Close"
              >×</button>
              <img
                className="note-overlay-image"
                src={this.props.note.imageUrls[this.state.largeImage]}
              />
              <div className="note-overlay-gradient">
                {this.props.note.imageUrls.length > 1 ? (
                  <button
                    className="overlay-nav-btn overlay-nav-prev"
                    onClick={(e: any) => { e.stopPropagation(); this.moveFocusedImage(-1) }}
                    disabled={this.state.largeImage === 0}
                  >
                    <img src={left_arrow} />
                  </button>
                ) : null}
                <div className="note-overlay-text-panel" onClick={(e: any) => e.stopPropagation()}>
                  {this.state.pendingTitle ? (
                    <div className="note-overlay-title">{this.state.pendingTitle}</div>
                  ) : null}
                  {this.state.pendingText ? (
                    <div
                      className="note-overlay-text"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(this.state.pendingText) }}
                    />
                  ) : null}
                  {(this.state.pendingAuthorName || this.state.pendingWorkName) ? (
                    <div className="note-overlay-citation">
                      <WorkCitationSpan
                        plain={true}
                        authorName={this.state.pendingAuthorName ?? this.props.note?.work?.author?.name}
                        workTitle={this.state.pendingWorkName}
                      />
                    </div>
                  ) : null}
                </div>
                {this.props.note.imageUrls.length > 1 ? (
                  <button
                    className="overlay-nav-btn overlay-nav-next"
                    onClick={(e: any) => { e.stopPropagation(); this.moveFocusedImage(1) }}
                    disabled={this.state.largeImage === this.props.note.imageUrls.length - 1}
                  >
                    <img src={right_arrow} />
                  </button>
                ) : null}
              </div>
              {this.props.note.imageUrls.length > 1 ? (
                <div className="note-overlay-dots" onClick={(e: any) => e.stopPropagation()}>
                  {this.props.note.imageUrls.map((_: any, i: any) => (
                    <button
                      key={i}
                      className={`overlay-dot${i === this.state.largeImage ? ' active' : ''}`}
                      onClick={() => this.setState({ largeImage: i })}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Text area */}
          {edit ? (
            <div data-name="text" className="width-100">
              <label htmlFor="text" className="note-full form-label">
                Text
                <ClickableLabelButton
                  onClick={() => {
                    this.runOCROnText()
                  }}
                >
                  {this.state.fetchingOcr ? 'Fetching' : 'OCR'}
                </ClickableLabelButton>
                <ClickableLabelButton
                  onClick={() => {
                    this.formatMainText()
                  }}
                >
                  Format
                </ClickableLabelButton>
              </label>

              <textarea
                id="text"
                className={'note-full note-text edit'}
                onChange={this.handleTextChange}
                value={this.state.pendingText}
              ></textarea>
            </div>
          ) : !this.state.overlayMode && this.state.pendingText ? (
            <div data-name="text" className="width-100">
              <div
                className={
                  'note-full note-text markdown' +
                  (this.state.largeImage >= 0 && (edit_ideas || edit_piles)
                    ? ' abbreviate'
                    : '')
                }
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(this.state.pendingText),
                }}
              />
            </div>
          ) : null}

          {/* Take */}
          {!this.state.overlayMode && edit && !this.state.compactEdit ? (
            <div data-name="take" className="width-100">
              <label htmlFor="take" className="note-full form-label">
                Take
              </label>
              <textarea
                id="take"
                className={'note-full note-take edit'}
                onChange={this.handleTakeChange}
                value={this.state.pendingTake}
              ></textarea>
            </div>
          ) : !this.state.overlayMode && this.state.pendingTake ? (
            <div data-name="take" className="width-100">
              <div
                className="note-full note-take markdown"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(this.state.pendingTake),
                }}
              />
            </div>
          ) : null}

          {/* Author, Work */}
          {edit ? (
            <>
              <div data-name="author" className="width-100">
                <label htmlFor="author" className="note-full form-label">
                  Author
                </label>
                <Autocomplete
                  className={'note-full edit-author'}
                  defaultValue={this.state.pendingAuthorName || ''}
                  dontAutofocus={true}
                  inputName={this.props.id + 'author'}
                  onSelect={this.handleUpdateAuthor}
                  getSuggestions={db.getSuggestions}
                  apiType={db.types.auth}
                  handleNewSelect={this.handleCreateAuthorAndAssign}
                  onClearText={this.handleClearAuthor.bind(this)}
                />
              </div>
              <div data-name="work" className="width-100">
                <label htmlFor="work" className="note-full form-label">
                  Work
                </label>
                <Autocomplete
                  inputName={this.props.id + 'work'}
                  dontAutofocus={true}
                  className={'note-full edit-work'}
                  defaultValue={this.state.pendingWorkName || ''}
                  onSelect={this.handleUpdateWork.bind(this)}
                  getSuggestions={db.getSuggestions}
                  apiType={db.types.work}
                  handleNewSelect={this.handleCreateWorkAndAssign.bind(this)}
                  onClearText={this.handleClearWork.bind(this)}
                />
              </div>
            </>
          ) : !this.state.overlayMode && (this.state.pendingAuthorId ||
            this.props.note?.work?.author ||
            this.state.pendingWorkId ||
            this.state.pendingYear ||
            this.state.pendingUrl ||
            this.props.note?.work?.url) ? (
            <div data-name="work" className="width-100">
              <div className="citation">
                <WorkCitationSpan
                  authorName={
                    this.state.pendingAuthorName ??
                    this.props.note?.work?.author?.name
                  }
                  authorID={
                    this.state.pendingAuthorId ??
                    this.props.note?.work?.author?._id
                  }
                  workTitle={this.state.pendingWorkName}
                  workID={this.state.pendingWorkId}
                  spaceAfter={false}
                />
                <YearUrlComboSpan
                  year={this.state.pendingYear ?? this.props.note.work?.year}
                  url={this.state.pendingUrl ?? this.props.note.work?.url}
                />

                {/* Page */}
                {this.state.pendingPage ? (
                  <>, {this.state.pendingPage}</>
                ) : this.props.note.work?.Page ? (
                  <>, ({this.props.note.work?.Page}</>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Edit URL */}
          {edit && !this.state.compactEdit ? (
            <>
              <div className="width-100">
                <label htmlFor="url" className="note-full form-label">
                  URL
                </label>
                <input
                  id="url"
                  className={'note-full url input edit'}
                  name="url"
                  defaultValue={this.state.pendingUrl}
                  onChange={this.handleUrlChange}
                ></input>
              </div>
            </>
          ) : null}
          {note.piles?.length > 0 ||
          note.ideas?.length > 0 ||
          Object.keys(this.state.linkedNotes).length > 0 ? (
            <div className={'note-full container width-100'}>
              <PileListForItem
                remove={edit_piles}
                allowTabbing={selected || edit_piles}
                allowAdd={false}
                edit={false}
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
              {note.ideas?.map((idea: any) =>
                edit_ideas ? (
                  <button
                    className="idea label edit"
                    key={'idea-button' + idea._id}
                    tabIndex={-1}
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
                      tabIndex={selected || edit_ideas ? undefined : -1}
                    >
                      {idea.name}
                    </button>
                  </Link>
                )
              )}
              {Object.keys(this.state.linkedNotes).length > 0 &&
                Object.keys(this.state.linkedNotes).map((note: any) => (
                  <Link key={note} to={'/note/' + note}>
                    <button
                      className="link label"
                      key={'link-button' + note}
                      tabIndex={selected || edit_ideas ? undefined : -1}
                    >
                      {this.state.linkedNotes[note]}
                    </button>
                  </Link>
                ))}
            </div>
          ) : (
            ''
          )}

          {edit && !this.state.compactEdit ? (
            <>
              <div className="width-20">
                <label htmlFor="page" className="note-full form-label">
                  Page
                </label>
                <input
                  id="page"
                  className={'note-full page input edit'}
                  name="url"
                  defaultValue={this.state.pendingPage}
                  onChange={this.handlePageChange}
                ></input>
              </div>
              <div className="width-20">
                <label htmlFor="year" className="note-full form-label">
                  Year
                </label>
                <input
                  id="year"
                  className="note-full year input edit"
                  defaultValue={this.state.pendingYear}
                  onChange={this.handleYearChange}
                ></input>
              </div>
            </>
          ) : null}

          {/* Action Bar */}
          <div className="note-full container width-100">
            <div className="action-bar">
              {edit ? (
                <>
                  <div className="left-div">
                    <ImageUploader
                      onImageUpload={this.onImageUpload.bind(this)}
                      buttonClassName="action-button"
                      iconOnly={true}
                    />
                  </div>

                  <div className="right-div">
                    <button
                      className={'button action-button'}
                      onClick={this.handleAccept.bind(this)}
                    >
                      <img src={check_circle}></img>
                    </button>
                    <button
                      className={'button action-button'}
                      onClick={this.toggleCompact.bind(this)}
                    >
                      <img
                        src={this.state.compactEdit ? eye : eye_closed}
                      ></img>
                    </button>
                    <button
                      className={'button action-button'}
                      onClick={() => {
                        this.props.setNoteMode(this.props.id, '')
                      }}
                    >
                      <img src={cross_circle}></img>
                    </button>
                  </div>
                </>
              ) : edit_ideas || edit_piles ? (
                <>
                  <Autocomplete
                    inputName={this.props.id + edit_ideas ? 'idea' : 'pile'}
                    className={edit_ideas ? 'idea' : 'pile'}
                    clearOnSelect={true}
                    showSuggestedIdeas={edit_ideas}
                    getIdeaSuggestions={this.handleSuggestedIdeas.bind(this)}
                    escape={() => {
                      edit_ideas
                        ? this.setState({ edit_ideas: false })
                        : this.setState({ edit_piles: false })
                    }}
                    onSelect={
                      edit_ideas
                        ? this.handleNewIdea.bind(this)
                        : this.handleNewPile.bind(this)
                    }
                    handleNewSelect={
                      edit_ideas
                        ? this.handleCreateIdeaAndAddToNote.bind(this)
                        : this.handleCreatePileAndAssign.bind(this)
                    }
                    getSuggestions={db.getSuggestions}
                    apiType={edit_ideas ? db.types.idea : db.types.pile}
                    excludeIds={
                      edit_ideas
                        ? note.ideas?.map((idea: any) => idea._id)
                        : note.piles?.map((pile: any) => pile._id)
                    }
                    excludeNames={
                      edit_ideas ? note.ideas?.map((idea: any) => idea.name) : null
                    }
                  />
                </>
              ) : edit_links ? (
                <>
                  <div className="right-div">
                    <input
                      className="note-link-input"
                      autoFocus
                      value={this.state.linkToAdd}
                      onChange={(e: any) => {
                        this.setState({
                          linkToAdd: e.target.value,
                        })
                      }}
                    ></input>
                  </div>
                </>
              ) : (
                // Neither editing whole note nor ideas
                <span>
                  <ClickToCopyNick
                    nick={this.state.nick}
                    style={{ verticalAlign: 'super', marginRight: '8px' }}
                  />
                  {!this.props.note.embeddingHash ? (
                    <span
                      className="embedding-missing-dot"
                      title="Not yet embedded"
                    />
                  ) : null}
                  <PinButton
                    type="note"
                    id={this.props.id}
                    label={noteLabel}
                    href={`/note/${this.props.id}`}
                    className="button action-button"
                    compact={true}
                    showLabel={false}
                    stopPropagation={false}
                    tabIndex={
                      selected || edit || edit_ideas || edit_piles || edit_links
                        ? this.props.tabIndex
                        : '-1'
                    }
                  />
                  <button
                    className={'button action-button'}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT_PILES
                      )
                    }}
                    tabIndex={selected ? this.props.tabIndex : '-1'}
                  >
                    <img src={pile_img}></img>
                  </button>
                  <button
                    className={'button action-button'}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT_IDEAS
                      )
                    }}
                    tabIndex={selected ? this.props.tabIndex : '-1'}
                  >
                    <img src={tags}></img>
                  </button>
                  <Link to={'/note/' + this.props.id}>
                    <button
                      className={'button action-button'}
                      tabIndex={selected ? this.props.tabIndex : '-1'}
                    >
                      <img src={document_image}></img>
                    </button>
                  </Link>
                  <button
                    className={'button action-button'}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT_LINKS
                      )
                    }}
                    tabIndex={selected ? this.props.tabIndex : '-1'}
                  >
                    <img src={link}></img>
                  </button>
                  <button
                    className={'button action-button'}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT
                      )
                    }}
                    tabIndex={selected ? this.props.tabIndex : '-1'}
                  >
                    <img src={write}></img>
                  </button>
                  <button
                    onClick={this.handleDelete.bind(this)}
                    className={'button action-button'}
                    tabIndex={selected ? this.props.tabIndex : '-1'}
                  >
                    <img src={trash}></img>
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

// Wrapper component that provides keyboard shortcuts
function NoteWithKeyboard(props: any) {
  const noteRef = React.useRef<Note | null>(null)

  // Determine the keyboard scope based on the current mode
  const getScope = () => {
    switch (props.mode) {
      case constants.note_modes.EDIT:
        return constants.keyboardScopes.NOTE_EDIT
      case constants.note_modes.EDIT_IDEAS:
        return constants.keyboardScopes.NOTE_EDIT_IDEAS
      case constants.note_modes.EDIT_PILES:
        return constants.keyboardScopes.NOTE_EDIT_PILES
      case constants.note_modes.EDIT_LINKS:
        return constants.keyboardScopes.NOTE_EDIT_LINKS
      case constants.note_modes.SELECTED:
        return constants.keyboardScopes.NOTE_SELECTED
      default:
        return null
    }
  }

  const scope = getScope()

  // Section 5: Note Editing keyboard shortcuts
  useKeyboardShortcuts(
    scope || constants.keyboardScopes.NOTE_EDIT, // fallback scope, won't match if null
    (event: any) => {
      if (!noteRef.current || !scope) return false
      return noteRef.current.handleKeyboardShortcut(event)
    },
    [props.mode]
  )

  return <Note ref={noteRef} {...props} />
}

export default NoteWithKeyboard
