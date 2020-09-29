import axios from 'axios'

export const url_api = 'http://localhost:3000/api/'

export async function deleteNote(id) {
  return axios.delete(url_api + `note/${id}`)
}

export async function createIdeaAndAddToNote(ideaName, noteId) {
  const data = { name: ideaName }
  return axios.put(url_api + `note/${noteId}/idea/create`, data)
}

export async function createPileAndAddToNote(pileName, noteId) {
  const data = { name: pileName }
  return axios.put(url_api + `note/${noteId}/pile/create`, data)
}

export async function getNoteInfo(noteId) {
  return axios.get(url_api + `note/${noteId}`)
}

export async function updateNoteInfo(noteId, params) {
  return axios.put(url_api + `note/${noteId}`, params)
}

export async function updateWorkInfo(workId, params) {
  return axios.put(url_api + `work/${workId}`, params)
}

export async function getIdeaSuggestions(search, withCounts = false) {
  const data = { string: search }

  if (!withCounts) {
    return axios.post(url_api + `idea/autocomplete`, data)
  } else {
    return axios.post(url_api + `idea/autocomplete/with-counts`, data)
  }
}

export async function getAuthorSuggestions(search, withCounts = false) {
  const data = { string: search }
  if (!withCounts) {
    return axios.post(url_api + `auth/autocomplete`, data)
  } else {
    return axios.post(url_api + `auth/autocomplete/with-counts`, data)
  }
}

export async function getWorkSuggestions(search, withCounts = false) {
  const data = { string: search }
  if (!withCounts) {
    return axios.post(url_api + `work/autocomplete`, data)
  } else {
    return axios.post(url_api + `work/autocomplete/with-counts`, data)
  }
}

export async function getPileSuggestions(search, withCounts = false) {
  const data = { string: search }
  if (!withCounts) {
    return axios.post(url_api + `pile/autocomplete`, data)
  } else {
    return axios.post(url_api + `pile/autocomplete/with-counts`, data)
  }
}

export async function createWork(workName) {
  const data = { name: workName }
  return axios.post(url_api + `work`, data)
}

export async function createAuthor(authorName) {
  const data = { name: authorName }
  return axios.post(url_api + `auth`, data)
}

export async function getNotesForIdea(ideaId) {
  return axios.get(url_api + `idea/${ideaId}/notes`)
}

export async function getIdeaInfo(ideaId) {
  return axios.get(url_api + `idea/${ideaId}`)
}

export async function getPileInfo(pileId) {
  return axios.get(url_api + `pile/${pileId}`)
}

export async function getNotesForWork(workId) {
  return axios.get(url_api + `work/${workId}/notes`)
}

export async function getWorkInfo(workId) {
  return axios.get(url_api + `work/${workId}`)
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

export async function addYearToWork(workId, newYear) {
  const data = { year: newYear }
  return axios.put(url_api + `work/${workId}`, data)
}

export async function createAuthorAndAddToWork(workId, authorName) {
  const data = { author: authorName }
  return axios.put(url_api + `work/${workId}/auth/create`, data)
}

export async function createNewNoteFromTitle(title) {
  const data = { title: title }
  return axios.post(url_api + 'note', data)
}

export async function searchNotes(searchString) {
  const data = { searchString: searchString }
  return axios.put(url_api + 'note/find', data)
}

export async function getNotesForAuthor(authorId) {
  return axios.get(url_api + `auth/${authorId}/notes`)
}

export async function getWorksForAuthor(authorId) {
  return axios.get(url_api + `auth/${authorId}/works`)
}

export async function getAuthorInfo(authorId) {
  return axios.get(url_api + `auth/${authorId}`)
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

export async function createPileAndAddToWork(pileName, workId) {
  const data = { name: pileName }
  return axios.put(url_api + `work/${workId}/pile/create`, data)
}

export async function addAuthorToNote(authorId, noteId) {
  const updateObject = { author: authorId }
  return updateNoteInfo(noteId, updateObject)
}

export async function addWorkToNote(workId, noteId) {
  const updateObject = { work: workId }
  return updateNoteInfo(noteId, updateObject)
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

export async function createIdea(ideaName) {
  const data = { name: ideaName }
  return axios.post(url_api + `idea`, data)
}

export async function createPile(pileName) {
  const data = { name: pileName }
  return axios.post(url_api + `pile`, data)
}

export async function getRecentNotes(page) {
  return axios.get(url_api + `note/all/` + page)
}

export async function removeIdeaFromNote(noteId, ideaId) {
  return axios.delete(url_api + 'note/' + noteId + '/idea/' + ideaId)
}

export async function removePileFromWork(workId, pileId) {
  return axios.delete(url_api + 'work/' + workId + '/pile/' + pileId)
}

export async function removePileFromNote(noteId, pileId) {
  return axios.delete(url_api + 'note/' + noteId + '/pile/' + pileId)
}

export async function addImageToNote(noteId, image) {
  const data = new FormData()
  data.append('image', image)
  return axios.put(url_api + 'note/' + noteId + '/image', data)
}

export async function getImagesForNote(noteId, imageN) {
  return axios.get(url_api + 'note/' + noteId + '/images/' + imageN, {
    responseType: 'blob'
  })
}

// TODO: Update to use delete action rather than post -- see deleteImage
export async function deleteWork(workId) {
  return axios.post(url_api + 'work/' + workId + '/delete')
}

export async function deleteAuthor(authorId) {
  return axios.post(url_api + 'auth/' + authorId + '/delete')
}

export async function deleteIdea(ideaId) {
  return axios.post(url_api + 'idea/' + ideaId + '/delete')
}

export async function deletePile(pileId) {
  return axios.delete(url_api + 'pile/' + pileId)
}

export async function deleteImage(noteId, imagePath) {
  const data = { filename: imagePath }
  return axios.delete(url_api + `note/${noteId}/image/`, { data: data })
}

export async function getNotesForPile(pileId) {
  return axios.get(url_api + `pile/${pileId}/notes`)
}

export async function getWorksForPile(pileId) {
  return axios.get(url_api + `pile/${pileId}/works`)
}
