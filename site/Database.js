import axios from 'axios'

export const url_api = 'http://localhost:3000/api/'

export async function deleteNote(id) {
  return axios.delete(urls.note.delete + id)
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
