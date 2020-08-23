import axios from 'axios'

export const url_api = 'http://localhost:3000/api/'

export async function deleteNote(id) {
  return axios.delete(urls.note.delete + id)
}

export async function addIdeaToNote(ideaID, noteID) {
  const data = { newTopic: ideaID }
  return axios.put(url_api + `note/${noteID}/idea`, data)
}

export async function createTopicAndAssign(ideaName, noteID) {
  const data = { newTopic: ideaName }
  return axios.put(url_api + `note/${noteID}/idea/create`, data)
}

export async function getNoteInfo(noteID) {
  return axios.get(url_api + `note/${noteID}`)
}

export async function updateNoteInfo(noteID, params) {
  return axios.put(url_api + `note/${noteID}`, params)
}

export async function getIdeaSuggestions(search) {
  const data = { string: search }
  return axios.post(url_api + `idea/autocomplete`, data)
}

export async function getAuthorSuggestions(search) {
  const data = { string: search }
  return axios.post(url_api + `auth/autocomplete`, data)
}

export async function createAuthor(authorName) {
  const data = { name: authorName }
  return axios.post(url_api + `auth`, data)
}
