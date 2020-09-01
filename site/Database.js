import axios from 'axios'
import { addAuthor } from '../server/src/resources/note/note.controllers'

export const url_api = 'http://localhost:3000/api/'

export async function deleteNote(id) {
  return axios.delete(url_api + `note/${id}`)
}

export async function createTopicAndAssign(ideaName, noteId) {
  const data = { newTopic: ideaName }
  return axios.put(url_api + `note/${noteId}/idea/create`, data)
}

export async function getNoteInfo(noteId) {
  return axios.get(url_api + `note/${noteId}`)
}

export async function updateNoteInfo(noteId, params) {
  return axios.put(url_api + `note/${noteId}`, params)
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
  return axios.put(url_api + `work/${workId}`, data)
}

export async function addUrlToWork(workId, url2) {
  const data = { url: url2 }
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

export async function getAuthorInfo(authorId) {
  return axios.get(url_api + `auth/${authorId}`)
}

export async function addIdeaToNote(ideaId, noteId) {
  const data = { newTopic: ideaId }
  return axios.put(url_api + `note/${noteId}/idea`, data)
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

export async function getRecentNotes() {
  return axios.get(url_api + `note/all`)
}

export async function removeIdeaFromNote(noteId, ideaId) {
  return axios.delete(url_api + 'note/' + noteId + '/idea/' + ideaId)
}
