import axios from 'axios'

export const types = {
  auth: 'auth',
  note: 'note',
  work: 'work',
  idea: 'idea',
  pile: 'pile',
}

// eslint-disable-next-line no-undef
export const url_api = process.env.SERVER_API

// Supported types: idea, auth, work, pile
export async function getSuggestions(type, search, withCounts = false) {
  const data = { string: search }

  if (!withCounts) {
    return axios.post(url_api + type + `/autocomplete`, data)
  } else {
    return axios.post(url_api + type + `/autocomplete/with-counts`, data)
  }
}

// Supported types: idea, auth, work, pile, note
export async function getInfo(type, Id) {
  return axios.get(url_api + type + `/${Id}`)
}

// Supported types: idea, auth, work, pile
export async function createRecord(type, name) {
  const data = { name: name }
  return axios.post(url_api + type, data)
}

// Supported types: note, work, idea, pile, auth
export async function updateRecord(type, id, params) {
  return axios.put(url_api + type + `/${id}`, params)
}

// Supported types: note, work, auth, idea, pile
export async function deleteRecord(type, id) {
  return axios.delete(url_api + type + `/${id}`)
}

// Supported combinations:
//   - idea from note
//   - pile from note
//   - pile from work
export async function removeFromRecord(removeType, removeId, fromType, fromId) {
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
export async function getRecordsWithFilter(recordType, filterType, filterId) {
  return axios.get(
    url_api + filterType + '/' + filterId + '/' + recordType + 's'
  )
}

// Supported combinations:
//   - create auth and add to work
//   - create pile and add to work
//   - create idea and add to note
//   - create pile and add to note
export async function createAndLinkToRecord(
  createType,
  createName,
  recordType,
  recordId
) {
  const data = { name: createName }
  return axios.put(
    url_api + recordType + '/' + recordId + '/' + createType + '/create',
    data
  )
}

// See appendLinkToRecord and setLinkOnRecord for supported combinations
export async function addLinkToRecord(linkType, linkId, recordType, recordId) {
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
export async function appendLinkToRecord(
  appendType,
  appendId,
  recordType,
  recordId
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
export async function setLinkOnRecord(linkType, linkId, recordType, recordId) {
  var data = {}
  if (linkType == types.auth) {
    data = { author: linkId }
  } else if (linkType == types.work) {
    data = { work: linkId }
  }
  return axios.put(url_api + recordType + '/' + recordId, data)
}

// Image handling
export async function addImageToNote(noteId, image) {
  const data = new FormData()
  data.append('image', image)
  return axios.put(url_api + 'note/' + noteId + '/image', data)
}

export async function deleteImage(noteId, imagePath) {
  const data = { filename: imagePath }
  return axios.delete(url_api + `note/${noteId}/image/`, { data: data })
}

export async function getImagesForNote(noteId, imageN) {
  return axios.get(url_api + 'note/' + noteId + '/images/' + imageN, {
    responseType: 'blob',
  })
}

// Generic Note Functions
export async function createNewNoteFromTitle(title) {
  const data = { title: title }
  return axios.post(url_api + 'note', data)
}

export async function createNewNoteForWork(workId) {
  const data = { work: workId }
  return axios.post(url_api + 'note', data)
}

// TODO: Create a one-request version of this
export async function createNewNoteWithImageForWork(workId, image, title) {
  const data = { title: title, work: workId }
  const createdNote = await axios.post(url_api + 'note', data)
  return addImageToNote(createdNote.data._id, image)
}

export async function searchNotes(searchString) {
  const data = { searchString: searchString }
  return axios.put(url_api + 'note/find', data)
}

export async function getRecentNotes(page) {
  return axios.get(url_api + `note/all/` + page)
}

export async function getAllPiles() {
  return axios.get(url_api + `pile/all`)
}

export async function getEarliestNotesToFile(page) {
  return axios.get(url_api + `note/file/` + page)
}

export async function getRandomNotes() {
  return axios.get(url_api + `note/flip`)
}

export async function getTitleSuggestion(noteID) {
  return axios.get(url_api + `note/` + noteID + `/title/suggest`)
}

export async function getIdeaSuggestions(noteID) {
  return axios.get(url_api + `note/` + noteID + `/ideas/suggest`)
}

export async function getNoteTextOCR(noteID) {
  return axios.get(url_api + `note/` + noteID + `/ocr`)
}

export async function getNoteNick(noteID) {
  return axios.put(url_api + `nick/note/` + noteID)
}

export async function getWorkNick(workID) {
  return axios.put(url_api + `nick/work/` + workID)
}

export async function getIdeaNick(ideaID) {
  return axios.put(url_api + `nick/idea/` + ideaID)
}

export async function getPileNick(pileID) {
  return axios.put(url_api + `nick/pile/` + pileID)
}

export async function getNick(nick) {
  return axios.get(url_api + `nick/` + nick)
}

export async function getAuthentication(password) {
  const data = { username: 'commonplace', password: password }
  return axios.post(url_api + `user/auth`, data)
}

export async function importNotesForWork(notesText, workID) {
  const data = { notesText: notesText }
  return axios.put(url_api + 'note/import/work/' + workID, data)
}

export async function importNotesCsv(importList) {
  const data = { importList: importList }
  return axios.put(url_api + 'note/import/csv', data)
}

export async function addNoteLinkToNote(leftNick, rightNick) {
  const data = { leftNoteNick: leftNick, rightNoteNick: rightNick }
  return axios.put(url_api + 'link/', data)
}
