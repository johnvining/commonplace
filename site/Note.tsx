import React from 'react'
import { showToast } from './Toast'
import { Link } from 'react-router-dom'
import { guessYearFromURL, NO_AUTOFILL, wornClass } from './utils'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import AuthorsChipList from './AuthorsChipList'
import IdeasPillList from './IdeasPillList'
import PilesPillList from './PilesPillList'
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
import { NoteButton } from './TopLevelStandardButton'

// True when the key event came from a text field that isn't part of the
// note with this id.
function isFieldOutsideNote(target: any, noteId: string) {
  if (!target || typeof target.closest !== 'function') return false
  const isField =
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  if (!isField) return false
  return !target.closest(`[data-note-id="${noteId}"]`)
}

function AiTitleTag() {
  return (
    <span className="ai-title-tag" title="Title suggested by AI. Edit it to remove this mark.">
      AI
    </span>
  )
}

class Note extends React.Component<any, any> {
  state: any = {
    // Long text is clamped in lists (see clampText); these track whether
    // it actually overflows and whether the reader asked for all of it.
    textOverflows: false,
    textExpanded: false,
    largeImage: -1,
    lightboxOpen: false,
    overlayMode: false,
    focusEdit: false,
    pendingAuthors: [] as import('./authorsDisplay').AuthorLike[],
    pendingPeople: [] as import('./authorsDisplay').AuthorLike[],
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

  // Text the editor last took from an upload response, until the note's
  // props catch up (see onImageUpload). A refetch from an earlier upload
  // can land with older text, so only let go once the props match.
  _serverText: string | null = null
  _textRef = React.createRef<HTMLDivElement>()

  // Clamp long text everywhere but the note's own page.
  clampText() {
    return !this.state.textExpanded && window.location.pathname !== '/note/' + this.props.id
  }

  measureTextOverflow() {
    const el = this._textRef.current
    const overflows = !!el && this.clampText() && el.scrollHeight > el.clientHeight + 1
    if (overflows !== this.state.textOverflows) this.setState({ textOverflows: overflows })
  }

  componentDidUpdate(prevProps: any) {
    this.measureTextOverflow()
    if (this._serverText !== null && this.props.note?.text === this._serverText) {
      this._serverText = null
    }
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
    this.measureTextOverflow()
    if (this.props.note.nick) {
      this.setState({ nick: this.props.note.nick })
    } else {
      db.getNoteNick(this.props.id).then((response: any) => {
        this.setState({ nick: response.data.data.key })
      })
    }

    this.fetchLinkedNotes()

    this.setState({
      pendingAuthors: Array.isArray(this.props.note.authors) ? this.props.note.authors : [],
      pendingPeople: Array.isArray(this.props.note.people) ? this.props.note.people : [],
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

    // Note handlers outrank entity handlers, so without this a key typed
    // into a field elsewhere on the page (e.g. the idea name on an idea
    // page) would act on this note: Ctrl+S replaced its title (#316),
    // Ctrl+A saved it.
    if (isFieldOutsideNote(event.target, this.props.id)) {
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

    // Single keys on a selected note: copy its nick, show the rest of a
    // long text, zoom the open image, delete (asks first).
    if (selected && !anyEditMode) {
      if (shortcuts.note.copyNick(event) && this.state.nick) {
        navigator.clipboard?.writeText(this.state.nick)
        showToast({ kind: 'success', message: `Copied ${this.state.nick}`, ttl: 1500 })
        return true
      }
      if (shortcuts.note.more(event) && this.state.textOverflows && this.clampText()) {
        this.setState({ textExpanded: true })
        return true
      }
      if (shortcuts.note.zoom(event) && this.state.overlayMode && this.state.largeImage >= 0) {
        this.setState((state: any) => ({ lightboxOpen: !state.lightboxOpen }))
        return true
      }
      if (shortcuts.note.delete(event)) {
        this.handleDelete()
        return true
      }
    }

    // Edit mode: Ctrl+U picks images to upload, Ctrl+M shows fewer/all fields.
    if (editMode) {
      if (shortcuts.note.upload(event)) {
        const input = document.getElementById(this.props.id)?.querySelector('input[type=file]') as HTMLInputElement | null
        input?.click()
        return true
      }
      if (shortcuts.note.toggleFields(event)) {
        this.toggleCompact()
        return true
      }
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
    // ← / → do the same, but only claim the keys when there are images.
    const step = shortcuts.note.prevImageKey(event) ? -1 : shortcuts.note.nextImageKey(event) ? 1 : 0
    if (step && this.props.note.imageUrls?.length) {
      this.moveFocusedImage(step)
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

  // Clicking a note (anywhere but its controls) opens it on its own page;
  // Cmd/Ctrl-click opens it in a new tab. Not while editing, not after
  // selecting text, and not on the note's own page.
  handleCardClick = (event: any) => {
    const viewing =
      this.props.mode === constants.note_modes.NO_SELECTION ||
      this.props.mode === constants.note_modes.NOT_SELECTED ||
      this.props.mode === constants.note_modes.SELECTED
    if (!viewing || !this.props.openNote) return
    const url = '/note/' + this.props.id
    if (window.location.pathname === url) return
    const interactive =
      'a, button, input, textarea, select, img, label, .action-bar, .click-to-copy-nick, .image-reader, .lightbox-backdrop'
    if ((event.target as HTMLElement).closest(interactive)) return
    if (!window.getSelection()?.isCollapsed) return
    if (event.metaKey || event.ctrlKey) {
      window.open(url, '_blank')
      return
    }
    this.props.openNote(this.props.id)
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

  handleUpdateAuthors = (authors: import('./authorsDisplay').AuthorLike[]) => {
    this.setState({ pendingAuthors: authors })
  }

  handleUpdatePeople = (people: import('./authorsDisplay').AuthorLike[]) => {
    this.setState({ pendingPeople: people })
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
      authors: this.state.pendingAuthors.map((a: any) => a._id).filter(Boolean),
      people: this.state.pendingPeople.map((p: any) => p._id).filter(Boolean),
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
      this._serverText = null
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

  // True while the title is exactly what AI suggested (#330); editing it
  // clears the mark. The server remembers the suggestion as aiTitle; a
  // suggestion fetched in this editor counts before it's saved.
  isAiTitle() {
    const title = this.state.pendingTitle
    const suggested = this.state.suggestedTitle ?? this.props.note.aiTitle
    return Boolean(title) && title === suggested
  }

  async generateTitleSuggestion() {
    this.setState({ fetchingTitleSuggestion: true })
    await db.getTitleSuggestion(this.props.id).then((response: any) => {
      this.setState({
        pendingTitle: response.data.suggested_title,
        suggestedTitle: response.data.suggested_title,
        fetchingTitleSuggestion: false,
      })
    })
  }

  async runOCROnText() {
    this.setState({ fetchingOcr: true })
    db.getNoteTextOCR(this.props.id).then((response: any) => {
      const newText = response.data.data
      // Images with no text (photos, paintings) leave the text alone.
      if (!newText?.trim()) {
        this.setState({ fetchingOcr: false })
        showToast({ kind: 'info', message: 'No text found in the images' })
        return
      }
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
    // The editor keeps its own copy of the text. If it has no unsaved
    // edits, take the text the server filled in from the image (auto OCR),
    // or saving would write the old text back over it.
    const response: any = await db.addImageToNote(this.props.id, image)
    const newText = response?.data?.data?.newNote?.text
    if (typeof newText === 'string') {
      // Decide in an updater. Updaters run in order against the latest
      // editor text, so with several images each upload builds on the
      // last one's text even before the note is refetched; anything typed
      // meanwhile is kept.
      this.setState(
        (prev: any) => {
          const lastServerText = this._serverText ?? this.props.note.text ?? ''
          if (newText === lastServerText || (prev.pendingText ?? '') !== lastServerText) return null
          this._serverText = newText
          return { pendingText: newText }
        },
        () => {
          const textArea = document.querySelector('#text') as HTMLElement | null
          if (textArea) autosize.update(textArea)
        }
      )
    }
    this.props.getImagesForNoteAtIndex(this.props.index, true)
  }

  handleFocusImage(index: any) {
    if (this.isInEditMode()) {
      this.setState({ largeImage: index, focusEdit: true, lightboxOpen: false, overlayMode: false })
    } else {
      this.setState({ largeImage: index, lightboxOpen: false, overlayMode: true })
      if (this.props.mode !== constants.note_modes.SELECTED) {
        this.props.setNoteMode(this.props.id, constants.note_modes.SELECTED)
      }
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

  // Step to the next/previous image; with none open, open the first (or,
  // going back, the last).
  moveFocusedImage(val: any) {
    const urls = this.props.note.imageUrls
    if (!urls?.length) return
    if (this.state.largeImage < 0) {
      this.handleFocusImage(val > 0 ? 0 : urls.length - 1)
      return
    }
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
        class_name = 'note-full edit-note edit-ideas '
        edit_ideas = true
        break
      case constants.note_modes.EDIT_PILES:
        class_name = 'note-full edit-note edit-piles '
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
          wornClass(this.props.note.openCount) +
          ''
        }
        key={this.props.id}
        id={this.props.id}
        data-note-id={this.props.id}
        tabIndex={no_selection || not_selected ? this.props.tabIndex : '-1'}
        onKeyDown={this.handleSelectKeyDown}
        onClick={this.handleCardClick}
      >

        {this.state.lightboxOpen && this.state.largeImage >= 0 ? (
          <div className="lightbox-backdrop" onClick={() => this.setState({ lightboxOpen: false })}>
            <div className="lightbox-content" onClick={e => e.stopPropagation()}>
              {this.props.note.imageUrls.length > 1 && (
                <button
                  className="lightbox-nav lightbox-prev"
                  title="Previous image (←)"
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
                  title="Next image (→)"
                  onClick={() => this.moveFocusedImage(1)}
                  disabled={this.state.largeImage === this.props.note.imageUrls.length - 1}
                >›</button>
              )}
              <button className="lightbox-close" title="Close (Esc)" onClick={() => this.setState({ lightboxOpen: false })}>×</button>
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
                    title="Previous image (←)"
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
                    title="Next image (→)"
                    onClick={() => this.moveFocusedImage(1)}
                    disabled={this.state.largeImage === this.props.note.imageUrls.length - 1}
                  >›</button>
                )}
              </div>
              <div className="focus-edit-text-side">
                <button className="focus-edit-close" title="Close (Esc)" onClick={() => this.setState({ focusEdit: false })}>×</button>
                <label className="note-full form-label">
                  Text
                  <ClickableLabelButton shortcut="Ctrl+R" onClick={() => this.runOCROnText()}>
                    {this.state.fetchingOcr ? 'Fetching' : 'OCR'}
                  </ClickableLabelButton>
                  <ClickableLabelButton shortcut="Ctrl+F" onClick={() => this.formatMainText()}>Format</ClickableLabelButton>
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
                  title="Save (Ctrl+A)"
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
                    shortcut="Ctrl+S"
                    onClick={() => {
                      this.generateTitleSuggestion()
                    }}
                  >
                    {this.state.fetchingTitleSuggestion
                      ? 'Fetching'
                      : 'Suggest'}
                  </ClickableLabelButton>
                  {this.isAiTitle() ? <AiTitleTag /> : null}
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
              <div className="note-full title">
                <Link to={'/note/' + this.props.id} className="title-link" tabIndex={-1}>
                  {this.state.pendingTitle}
                </Link>
                {this.isAiTitle() ? <AiTitleTag /> : null}
              </div>
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

          {/* Overlay mode — show the focused image at full natural size.
              Images here are usually text scans, so nothing covers them:
              navigation lives below the image, not on top of it. */}
          {/* Image reader: a large image beside the note's text, over the
              page. ← / → switch images, Esc or × closes, clicking the image
              opens the full-screen lightbox. */}
          {this.state.overlayMode && !edit && this.props.note.imageUrls?.length > 0 && this.state.largeImage >= 0 ? (
            <div className="image-reader" role="dialog" aria-label="Image and text">
              <div className="image-reader-image">
                <img
                  src={this.props.note.imageUrls[this.state.largeImage]}
                  onClick={() => this.setState({ lightboxOpen: true })}
                  title="Zoom (z)"
                  alt=""
                />
                {this.props.note.imageUrls.length > 1 ? (
                  <div className="image-reader-nav">
                    <button
                      className="button"
                      onClick={() => this.moveFocusedImage(-1)}
                      disabled={this.state.largeImage === 0}
                      aria-label="Previous image (←)"
                      title="Previous image (←)"
                    >
                      <img src={left_arrow} alt="" />
                    </button>
                    <span className="image-reader-count">
                      {this.state.largeImage + 1} / {this.props.note.imageUrls.length}
                    </span>
                    <button
                      className="button"
                      onClick={() => this.moveFocusedImage(1)}
                      disabled={this.state.largeImage === this.props.note.imageUrls.length - 1}
                      aria-label="Next image (→)"
                      title="Next image (→)"
                    >
                      <img src={right_arrow} alt="" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="image-reader-text">
                <button
                  className="image-reader-close"
                  onClick={() => this.setState({ overlayMode: false, largeImage: -1 })}
                  aria-label="Close (Esc)"
                  title="Close (Esc)"
                >
                  ×
                </button>
                {this.state.pendingTitle ? (
                  <div className="image-reader-title">{this.state.pendingTitle}</div>
                ) : null}
                <div className="citation">
                  <WorkCitationSpan
                    authors={
                      this.state.pendingAuthors.length
                        ? this.state.pendingAuthors
                        : this.props.note?.work?.authors
                    }
                    workTitle={this.state.pendingWorkName}
                    workID={this.state.pendingWorkId}
                    spaceAfter={false}
                  />
                  <YearUrlComboSpan
                    year={this.state.pendingYear ?? this.props.note.work?.year}
                    url={this.state.pendingUrl ?? this.props.note.work?.url}
                  />
                  {this.state.pendingPage ? <>, {this.state.pendingPage}</> : null}
                </div>
                {this.state.pendingText ? (
                  <div
                    className="note-full note-text markdown"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(this.state.pendingText) }}
                  />
                ) : null}
                {this.state.pendingTake ? (
                  <div
                    className="note-full note-take markdown"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(this.state.pendingTake) }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Text area */}
          {edit ? (
            <div data-name="text" className="width-100">
              <label htmlFor="text" className="note-full form-label">
                Text
                <ClickableLabelButton
                  shortcut="Ctrl+R"
                  onClick={() => {
                    this.runOCROnText()
                  }}
                >
                  {this.state.fetchingOcr ? 'Fetching' : 'OCR'}
                </ClickableLabelButton>
                <ClickableLabelButton
                  shortcut="Ctrl+F"
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
          ) : this.state.pendingText ? (
            <div data-name="text" className="width-100">
              <div
                ref={this._textRef}
                className={
                  'note-full note-text markdown' +
                  (this.state.largeImage >= 0 && (edit_ideas || edit_piles)
                    ? ' abbreviate'
                    : this.clampText()
                    ? ' clamped'
                    : '')
                }
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(this.state.pendingText, { tabbableLinks: selected }),
                }}
              />
              {this.state.textOverflows && this.clampText() ? (
                <button
                  type="button"
                  className="note-more"
                  tabIndex={selected ? undefined : -1}
                  onClick={() => this.setState({ textExpanded: true })}
                  title="Show more (m)"
                >
                  Show more
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Take */}
          {edit && !this.state.compactEdit ? (
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
          ) : this.state.pendingTake ? (
            <div data-name="take" className="width-100">
              <div
                className="note-full note-take markdown"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(this.state.pendingTake, { tabbableLinks: selected }),
                }}
              />
            </div>
          ) : null}

          {/* Author, Work */}
          {edit ? (
            <>
              <div data-name="author" className="width-100">
                <label className="note-full form-label">Authors</label>
                <AuthorsChipList
                  value={this.state.pendingAuthors}
                  onChange={this.handleUpdateAuthors}
                  onExit={() =>
                    this.props.setNoteMode(
                      this.props.id,
                      constants.note_modes.SELECTED,
                    )
                  }
                  inputId={this.props.id + 'add-author'}
                  dontAutofocus
                />
              </div>
              <div data-name="people" className="width-100">
                <label className="note-full form-label">About</label>
                <AuthorsChipList
                  value={this.state.pendingPeople}
                  onChange={this.handleUpdatePeople}
                  onExit={() =>
                    this.props.setNoteMode(
                      this.props.id,
                      constants.note_modes.SELECTED,
                    )
                  }
                  inputId={this.props.id + 'add-person'}
                  dontAutofocus
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
          ) : !this.props.hideCitation && (this.state.pendingAuthors.length ||
            this.props.note?.work?.authors?.length ||
            this.state.pendingWorkId ||
            this.state.pendingYear ||
            this.state.pendingUrl ||
            this.props.note?.work?.url) ? (
            <div data-name="work" className="width-100">
              <div className="citation">
                <WorkCitationSpan
                  authors={
                    this.state.pendingAuthors.length
                      ? this.state.pendingAuthors
                      : this.props.note?.work?.authors
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
          note.people?.length > 0 ||
          Object.keys(this.state.linkedNotes).length > 0 ? (
            <div className={'note-full container width-100'}>
              {/* In edit_piles mode the PilesPillList below renders the
                  pills with their own × buttons, so we skip the inline
                  PileListForItem row to avoid duplication. */}
              {!edit_piles && (
                <PileListForItem allowTabbing={selected} piles={note.piles} />
              )}
              {/* In edit_ideas mode the IdeasPillList below renders the
                  pills with their own × buttons, so we skip the inline
                  chip row to avoid duplication. */}
              {!edit_ideas && note.ideas?.map((idea: any) => (
                <Link to={'/idea/' + idea._id} key={'idea-link' + idea._id} tabIndex={-1}>
                  <button
                    className="idea label"
                    key={'idea-button' + idea._id}
                    tabIndex={selected ? undefined : -1}
                  >
                    {idea.name}
                  </button>
                </Link>
              ))}
              {note.people?.map((person: any) => (
                <Link to={'/auth/' + person._id} key={'person-link' + person._id} tabIndex={-1}>
                  <button
                    className="person label"
                    tabIndex={selected ? undefined : -1}
                  >
                    {person.name}
                  </button>
                </Link>
              ))}
              {Object.keys(this.state.linkedNotes).length > 0 &&
                Object.keys(this.state.linkedNotes).map((note: any) => (
                  <Link key={note} to={'/note/' + note} tabIndex={-1}>
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
                      allowMultiple={true}
                      buttonClassName="action-button"
                      iconOnly={true}
                      shortcut="Ctrl+U"
                    />
                  </div>

                  <div className="right-div">
                    <NoteButton
                      icon={check_circle}
                      label="Save"
                      shortcut="Ctrl+A"
                      onClick={this.handleAccept.bind(this)}
                    />
                    <NoteButton
                      icon={this.state.compactEdit ? eye : eye_closed}
                      label={this.state.compactEdit ? 'Show all fields' : 'Show fewer fields'}
                      shortcut="Ctrl+M"
                      onClick={this.toggleCompact.bind(this)}
                    />
                    <NoteButton
                      icon={cross_circle}
                      label="Cancel"
                      shortcut="Esc"
                      onClick={() => {
                        this.props.setNoteMode(this.props.id, '')
                      }}
                    />
                  </div>
                </>
              ) : edit_ideas ? (
                <IdeasPillList
                  value={note.ideas ?? []}
                  onAddExisting={(idea) => this.handleNewIdea(idea._id)}
                  onCreateNew={(name) => this.handleCreateIdeaAndAddToNote(name)}
                  onRemove={(id) => this.removeIdea(id)}
                  onExit={() =>
                    this.props.setNoteMode(
                      this.props.id,
                      constants.note_modes.SELECTED,
                    )
                  }
                  fetchAiSuggestions={async () => {
                    const res: any = await db.getIdeaSuggestions(this.props.id)
                    const names: string[] = res?.data?.suggested_ideas ?? []
                    return names.map((name) => ({ name }))
                  }}
                  inputId={this.props.id + 'idea'}
                />
              ) : edit_piles ? (
                <PilesPillList
                  value={note.piles ?? []}
                  onAddExisting={(pile) => this.handleNewPile(pile._id)}
                  onCreateNew={(name) => this.handleCreatePileAndAssign(name)}
                  onRemove={(id) => this.handlePileRemove(id)}
                  onExit={() =>
                    this.props.setNoteMode(
                      this.props.id,
                      constants.note_modes.SELECTED,
                    )
                  }
                  inputId={this.props.id + 'pile'}
                />
              ) : edit_links ? (
                <>
                  <div className="right-div">
                    <input
                      className="note-link-input"
                      autoFocus
                      {...NO_AUTOFILL}
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
                    shortcut="Ctrl+S"
                    tabIndex={
                      selected || edit || edit_ideas || edit_piles || edit_links
                        ? this.props.tabIndex
                        : '-1'
                    }
                  />
                  <NoteButton
                    icon={pile_img}
                    label="Piles"
                    shortcut="Ctrl+P"
                    tabbable={selected}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT_PILES
                      )
                    }}
                  />
                  <NoteButton
                    icon={tags}
                    label="Ideas"
                    shortcut="Ctrl+T"
                    tabbable={selected}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT_IDEAS
                      )
                    }}
                  />
                  <Link to={'/note/' + this.props.id} tabIndex={-1}>
                    <NoteButton icon={document_image} label="Open note" shortcut="o or Enter" tabbable={selected} />
                  </Link>
                  <NoteButton
                    icon={link}
                    label="Links"
                    shortcut="Ctrl+L"
                    tabbable={selected}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT_LINKS
                      )
                    }}
                  />
                  <NoteButton
                    icon={write}
                    label="Edit"
                    shortcut="e or Ctrl+E"
                    tabbable={selected}
                    onClick={() => {
                      this.props.setNoteMode(
                        this.props.id,
                        constants.note_modes.EDIT
                      )
                    }}
                  />
                  <NoteButton
                    icon={trash}
                    label="Delete"
                    shortcut="#"
                    tabbable={selected}
                    onClick={this.handleDelete.bind(this)}
                  />
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
