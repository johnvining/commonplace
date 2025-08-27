import { useNavigate, useParams } from 'react-router-dom'
import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import { useState, useEffect } from 'react'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import {
  TopLevelSubTitle,
  TopLevelTitle,
  TopLevelTitleContainer,
} from './TopLevelHeadings'

function AuthorNotes(props) {
  const { id } = useParams()
  const [authorName, setAuthorName] = useState('')
  const navigate = useNavigate()

  const fetchAuthorInfo = (id) => {
    db.getInfo(db.types.auth, id)
      .then((response) => {
        setAuthorName(response.data.data.name)
      })
      .catch((error) => {
        console.error(error)
      })
  }

  const getAllNotesForAuthor = async () => {
    try {
      const authorNotesResponse = await db.getRecordsWithFilter(
        db.types.note,
        db.types.auth,
        id
      )
      const authorNotes = authorNotesResponse.data.data || []

      const worksResponse = await db.getRecordsWithFilter(
        db.types.work,
        db.types.auth,
        id
      )
      const works = worksResponse.data.data || []

      let workNotes = []
      if (works.length > 0) {
        const workNotesPromises = works.map((work) =>
          db.getRecordsWithFilter(db.types.note, db.types.work, work._id)
        )
        const workNotesResponses = await Promise.all(workNotesPromises)
        workNotes = workNotesResponses.flatMap(
          (response) => response.data.data || []
        )
      }

      const allNotes = [...authorNotes, ...workNotes]
      const uniqueNotes = allNotes.filter(
        (note, index, self) =>
          index === self.findIndex((n) => n._id === note._id)
      )

      return {
        data: {
          data: uniqueNotes,
        },
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
      return { data: { data: [] } }
    }
  }

  useEffect(() => {
    fetchAuthorInfo(id)
  }, [id])

  props.setPageTitle(`${authorName} - Notes`)

  return (
    <div>
      <TopLevelTitleContainer>
        <TopLevelTitle>{authorName}</TopLevelTitle>
        <TopLevelSubTitle>Notes</TopLevelSubTitle>
      </TopLevelTitleContainer>

      <TopLevelStandardButtonContainer>
        <TopLevelStandardButton
          name="Back to Author"
          onClick={() => navigate(`/auth/${id}`)}
        />
      </TopLevelStandardButtonContainer>

      <NoteList
        key={'all-author-notes-' + id}
        viewMode={props.viewMode}
        useGroupings={true}
        getListOfNotes={getAllNotesForAuthor}
      />
    </div>
  )
}

export default AuthorNotes
