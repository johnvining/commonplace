import axios from 'axios'
import { showToast } from './Toast'

axios.defaults.withCredentials = true
// CSRF defence-in-depth: server rejects state-changing requests without
// this header (set automatically only by same-origin JS, never by a CSRF
// form post).
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest'

// Surface server errors as toasts. 401s are handled separately by the
// validateAuth flow (which routes back to /login), so suppress them here
// to avoid a "Not authorized" toast on every page load before login.
// Aborted requests (StrictMode, route changes) are also silent.
axios.interceptors.response.use(
  r => r,
  error => {
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
      return Promise.reject(error)
    }
    const status = error?.response?.status
    if (status && status !== 401) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        `Request failed (${status})`
      showToast({ kind: 'error', message })
    } else if (!status && error?.message && error?.code !== 'ERR_CANCELED') {
      showToast({ kind: 'error', message: error.message })
    }
    return Promise.reject(error)
  },
)

export const types = {
  auth: 'auth',
  note: 'note',
  work: 'work',
  idea: 'idea',
  pile: 'pile',
}

// Parcel inlines `process.env.X` at build time; declared loosely for TS.
declare const process: { env: Record<string, string | undefined> }
const url_api = process.env.SERVER_API

// Supported types: idea, auth, work, pile
export async function getSuggestions(type: string, search: string, withCounts = false, signal?: AbortSignal) {
  const data = { string: search }
  const opts = signal ? { signal } : {}

  if (!withCounts) {
    return axios.post(url_api + type + `/autocomplete`, data, opts)
  } else {
    return axios.post(url_api + type + `/autocomplete/with-counts`, data, opts)
  }
}

// Supported types: idea, auth, work, pile, note
export async function getInfo(type: string, Id: string) {
  return axios.get(url_api + type + `/${Id}`)
}

// Get note by nick in a single request
export async function getNoteByNick(nick: string) {
  return axios.get(url_api + 'note/nick/' + nick)
}

// Supported types: idea, auth, work, pile
export async function createRecord(type: string, name: string) {
  const data = { name: name }
  return axios.post(url_api + type, data)
}

// Supported types: note, work, idea, pile, auth
export async function updateRecord(type: string, id: string, params: object) {
  return axios.put(url_api + type + `/${id}`, params)
}

// Supported types: note, work, auth, idea, pile
export async function deleteRecord(type: string, id: string) {
  return axios.delete(url_api + type + `/${id}`)
}

// Supported combinations:
//   - idea from note
//   - pile from note
//   - pile from work
export async function removeFromRecord(removeType: string, removeId: string, fromType: string, fromId: string) {
  return axios.delete(
    url_api + fromType + '/' + fromId + '/' + removeType + '/' + removeId
  )
}

// Supported combinations:
//   - notes filtered by auth
//   - notes filtered by pile
//   - notes filtered by idea
//   - notes filtered by work
//   - works filtered by auth
//   - works filtered by pile
export async function getRecordsWithFilter(recordType: string, filterType: string, filterId: string) {
  return axios.get(
    url_api + filterType + '/' + filterId + '/' + recordType + 's'
  )
}

// All notes for an author, including notes on their works
export async function getAllNotesForAuthor(authorId: string) {
  return axios.get(url_api + 'auth/' + authorId + '/all-notes')
}

// Supported combinations:
//   - create auth and add to work
//   - create pile and add to work
//   - create idea and add to note
//   - create pile and add to note
export async function createAndLinkToRecord(
  createType: string,
  createName: string,
  recordType: string,
  recordId: string
) {
  const data = { name: createName }
  return axios.put(
    url_api + recordType + '/' + recordId + '/' + createType + '/create',
    data
  )
}

// See appendLinkToRecord and setLinkOnRecord for supported combinations
export async function addLinkToRecord(linkType: string, linkId: string, recordType: string, recordId: string) {
  if (linkType == types.idea || linkType == types.pile) {
    return appendLinkToRecord(linkType, linkId, recordType, recordId)
  } else if (linkType == types.work || linkType == types.auth) {
    return setLinkOnRecord(linkType, linkId, recordType, recordId)
  }
  return null
}

// Supported combinations:
//   - add idea to note
//   - add pile to note
//   - add pile to work
async function appendLinkToRecord(
  appendType: string,
  appendId: string,
  recordType: string,
  recordId: string
) {
  const data = { id: appendId }
  return axios.put(
    url_api + recordType + '/' + recordId + '/' + appendType,
    data
  )
}

// Supported combinations:
//   - set work on note
//   - set auth on note
//   - set auth on work
async function setLinkOnRecord(linkType: string, linkId: string, recordType: string, recordId: string) {
  var data = {}
  if (linkType == types.auth) {
    data = { author: linkId }
  } else if (linkType == types.work) {
    data = { work: linkId }
  }
  return axios.put(url_api + recordType + '/' + recordId, data)
}

// Image handling
export async function addImageToNote(noteId: string, image: File | Blob) {
  const data = new FormData()
  data.append('image', image)
  return axios.put(url_api + 'note/' + noteId + '/image', data)
}

export async function deleteImage(noteId: string, imagePath: string) {
  const data = { filename: imagePath }
  return axios.delete(url_api + `note/${noteId}/image/`, { data: data })
}

export async function getImagesForNote(noteId: string, imageN: number) {
  return axios.get(url_api + 'note/' + noteId + '/images/' + imageN, {
    responseType: 'blob',
  })
}

// Generic Note Functions
export async function createNewNoteFromTitle(title: string) {
  const data = { title: title }
  return axios.post(url_api + 'note', data)
}

export async function createNewNoteForWork(workId: string) {
  const data = { work: workId }
  return axios.post(url_api + 'note', data)
}

// TODO: Create a one-request version of this
export async function createNewNoteWithImageForWork(workId: string, image: File | Blob, title: string) {
  const data = { title: title, work: workId }
  const createdNote = await axios.post(url_api + 'note', data)
  return addImageToNote(createdNote.data._id, image)
}

export async function searchNotes(searchString: string) {
  const data = { searchString: searchString }
  return axios.put(url_api + 'note/find', data)
}

export async function unifiedSearch(query: string, limit = 50, signal?: AbortSignal) {
  const opts = signal ? { signal } : {}
  return axios.post(url_api + 'note/unified-search', { query, limit }, opts)
}

export async function getRecentNotes(page: number | string) {
  return axios.get(url_api + `note/all/` + page)
}

export async function getAllPiles() {
  return axios.get(url_api + `pile/all`)
}

export async function getEarliestNotesToFile(page: number | string) {
  return axios.get(url_api + `note/file/` + page)
}

export async function getRandomNotes() {
  return axios.get(url_api + `note/flip`)
}

export async function getTitleSuggestion(noteID: string) {
  return axios.get(url_api + `note/` + noteID + `/title/suggest`)
}

export async function getIdeaSuggestions(noteID: string) {
  return axios.get(url_api + `note/` + noteID + `/ideas/suggest`)
}

export async function getNoteTextOCR(noteID: string) {
  return axios.get(url_api + `note/` + noteID + `/ocr`)
}

export async function bulkOcrForNotes(noteIds: string[]) {
  const data = { noteIds: noteIds }
  return axios.post(url_api + 'note/bulk-ocr', data)
}

export async function getStats() {
  return axios.get(url_api + 'stats')
}

export async function getRecentItems(type: string) {
  return axios.get(url_api + 'stats/recent/' + type)
}

export async function bulkSuggestTitlesForNotes(noteIds: string[]) {
  const data = { noteIds: noteIds }
  return axios.post(url_api + 'note/bulk-suggest-titles', data)
}

export async function bulkGetNotesForMarkdown(noteIds: string[]) {
  const data = { noteIds: noteIds }
  return axios.post(url_api + 'note/bulk-markdown', data)
}

export async function getNoteNick(noteID: string) {
  return axios.put(url_api + `nick/note/` + noteID)
}

export async function getWorkNick(workID: string) {
  return axios.put(url_api + `nick/work/` + workID)
}

export async function getIdeaNick(ideaID: string) {
  return axios.put(url_api + `nick/idea/` + ideaID)
}

export async function getPileNick(pileID: string) {
  return axios.put(url_api + `nick/pile/` + pileID)
}

export async function getNick(nick: string) {
  return axios.get(url_api + `nick/` + nick)
}

export async function getAuthentication(password: string) {
  const data = { username: 'commonplace', password: password }
  return axios.post(url_api + `user/auth`, data)
}

export async function getAuthStatus() {
  return axios.get(url_api + `user/me`)
}

export async function logout() {
  return axios.post(url_api + `user/logout`)
}

export async function importNotesForWork(notesText: string, workID: string) {
  const data = { notesText: notesText }
  return axios.put(url_api + 'note/import/work/' + workID, data)
}

export async function importNotesCsv(importList: string) {
  const data = { importList: importList }
  return axios.put(url_api + 'note/import/csv', data)
}

export async function importNotesInstapaper(importList: string) {
  const data = { importList: importList }
  return axios.put(url_api + 'note/import/instapaper', data)
}


export async function addNoteLinkToNote(leftNick: string, rightNick: string) {
  const data = { leftNoteNick: leftNick, rightNoteNick: rightNick }
  return axios.put(url_api + 'link/', data)
}

export async function getLinkedNotes(noteId: string) {
  return axios.get(url_api + 'link/note/' + noteId)
}
