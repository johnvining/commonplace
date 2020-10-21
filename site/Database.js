import axios from 'axios'

export const types = {
  auth: 'auth',
  note: 'note',
  work: 'work',
  idea: 'idea',
  pile: 'pile'
}

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

// Supported types: idea, auth, work, pile,
export async function createRecord(type, name) {
  const data = { name: name }
  return axios.post(url_api + type, data)
}

// Supported types: note, work
export async function updateRecord(type, id, params) {
  return axios.put(url_api + type + `/${id}`, params)
}

// Supported types: note, work, auth, idea, pile
export async function deleteRecord(type, id) {
  return axios.delete(url_api + type + `/${id}`)
}

// Supported cobminations:
//   - idea from note
//   - pile from note
//   - pile from work
export async function removeFromRecord(removeType, removeId, fromType, fromId) {
  return axios.delete(
    url_api + fromType + '/' + fromId + '/' + removeType + '/' + removeId
  )
}

export async function createIdeaAndAddToNote(ideaName, noteId) {
  const data = { name: ideaName }
  return axios.put(url_api + `note/${noteId}/idea/create`, data)
}

export async function createPileAndAddToNote(pileName, noteId) {
  const data = { name: pileName }
  return axios.put(url_api + `note/${noteId}/pile/create`, data)
}

export async function getNotesForIdea(ideaId) {
  return axios.get(url_api + `idea/${ideaId}/notes`)
}

export async function getNotesForWork(workId) {
  return axios.get(url_api + `work/${workId}/notes`)
}

export async function addAuthorToWork(workId, authorId) {
  const data = { author: authorId }
  return axios.put(url_api + `work/${workId}`, data)
}

export async function addUrlToWork(workId, newUrl, newYear) {
  const data = { url: newUrl }
  if (newYear) {
    data.year = newYear
  }
  return axios.put(url_api + `work/${workId}`, data)
}

// Add X to Y
export async function addYearToWork(workId, newYear) {
  const data = { year: newYear }
  return axios.put(url_api + `work/${workId}`, data)
}

export async function addIdeaToNote(ideaId, noteId) {
  const data = { id: ideaId }
  return axios.put(url_api + `note/${noteId}/idea`, data)
}

export async function addPileToNote(pileId, noteId) {
  const data = { id: pileId }
  return axios.put(url_api + `note/${noteId}/pile`, data)
}

export async function addPileToWork(pileId, workId) {
  const data = { id: pileId }
  return axios.put(url_api + `work/${workId}/pile`, data)
}

export async function addAuthorToNote(authorId, noteId) {
  const updateObject = { author: authorId }
  return updateNoteInfo(noteId, updateObject)
}

export async function addWorkToNote(workId, noteId) {
  const updateObject = { work: workId }
  return updateNoteInfo(noteId, updateObject)
}

async function updateNoteInfo(noteId, updateObject) {
  return axios.put(url_api + `note/${noteId}`, updateObject)
}

// Create X and add to Y
export async function createAuthorAndAddToWork(workId, authorName) {
  const data = { author: authorName }
  return axios.put(url_api + `work/${workId}/auth/create`, data)
}

export async function createNewNoteFromTitle(title) {
  const data = { title: title }
  return axios.post(url_api + 'note', data)
}

export async function createPileAndAddToWork(pileName, workId) {
  const data = { name: pileName }
  return axios.put(url_api + `work/${workId}/pile/create`, data)
}

export async function createAuthorAndAddToNote(authorName, noteId) {
  // TODO: Make single request
  const newAuthor = await createAuthor(authorName)
  return addAuthorToNote(newAuthor._id, noteId)
}

export async function createWorkAndAddToNote(workName, noteId) {
  // TODO: Make single request
  const newWork = await createWork(workName)
  return addWorkToNote(newWork._id, noteId)
}

// Get X for Y
export async function getNotesForAuthor(authorId) {
  return axios.get(url_api + `auth/${authorId}/notes`)
}

export async function getWorksForAuthor(authorId) {
  return axios.get(url_api + `auth/${authorId}/works`)
}

export async function getNotesForPile(pileId) {
  return axios.get(url_api + `pile/${pileId}/notes`)
}

export async function getWorksForPile(pileId) {
  return axios.get(url_api + `pile/${pileId}/works`)
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
    responseType: 'blob'
  })
}

// Generic get-notes functions
export async function searchNotes(searchString) {
  const data = { searchString: searchString }
  return axios.put(url_api + 'note/find', data)
}

export async function getRecentNotes(page) {
  return axios.get(url_api + `note/all/` + page)
}
