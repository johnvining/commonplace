import axios from 'axios'

export const url_api = 'http://localhost:3000/api/'

export async function deleteNote(id) {
  return axios.delete(url_api + `note/${id}`)
}

export async function addIdeaToNote(ideaID, nodeId) {
  const data = { newTopic: ideaID }
  return axios.put(url_api + `note/${nodeId}/idea`, data)
}

export async function createTopicAndAssign(ideaName, nodeId) {
  const data = { newTopic: ideaName }
  return axios.put(url_api + `note/${nodeId}/idea/create`, data)
}

export async function getNoteInfo(nodeId) {
  return axios.get(url_api + `note/${nodeId}`)
}

export async function updateNoteInfo(nodeId, params) {
  return axios.put(url_api + `note/${nodeId}`, params)
}

export async function getIdeaSuggestions(search) {
  const data = { string: search }
  return axios.post(url_api + `idea/autocomplete`, data)
}

export async function getAuthorSuggestions(search) {
  const data = { string: search }
  return axios.post(url_api + `auth/autocomplete`, data)
}

export async function getWorkSuggestions(search) {
  const data = { string: search }
  return axios.post(url_api + `work/autocomplete`, data)
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

export async function getNotesForWork(workId) {
  return axios.get(url_api + `work/${workId}/notes`)
}

export async function getWorkInfo(workId) {
  return axios.get(url_api + `work/${workId}`)
}

export async function addAuthorToWork(workId, authorId) {
  const data = { author: authorId }
  return axios.put(url_api + `work/${workId}/auth`, data)
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
  return axios.get(`http://localhost:3000/api/auth/${authorId}/notes`)
}

export async function getAuthorInfo(authorId) {
  return axios.get(`http://localhost:3000/api/auth/${authorId}`)
}
