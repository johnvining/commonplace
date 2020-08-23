import * as urls from './urls'
import axios from 'axios'

export async function deleteNote(id) {
  return axios.delete(urls.note.delete + id)
}

export async function addIdeaToNote(ideaID, noteID) {
  const data = { newTopic: ideaID }
  return axios.put(`http://localhost:3000/api/note/${noteID}/idea`, data)
}

export async function createTopicAndAssign(ideaName, noteID) {
  const data = { newTopic: ideaName }
  return axios.put(`http://localhost:3000/api/note/${noteID}/idea/create`, data)
}

export async function getNoteInfo(noteID) {
  console.log(`http://localhost:3000/api/note/${noteID}`)
  return axios.get(`http://localhost:3000/api/note/${noteID}`)
}

export async function updateNoteInfo(noteID, params) {
  console.log('update Note Info')
  return axios.put(`http://localhost:3000/api/note/${noteID}`, params)
}

export async function getIdeaSuggestions(search) {
  const data = { string: search }
  return axios.post(`http://localhost:3000/api/idea/autocomplete`, data)
}

export async function getAuthorSuggestions(search) {
  const data = { string: search }
  return axios.post(`http://localhost:3000/api/auth/autocomplete`, data)
}

export async function createAuthor(authorName) {
  const data = { name: authorName }
  return axios.post(`http://localhost:3000/api/auth`, data)
}
