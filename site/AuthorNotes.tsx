import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'
import NoteList from './NoteList'
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

function AuthorNotes(props: any) {
  const { id = '' } = useParams()
  const [authorName, setAuthorName] = useState('')
  const navigate = useNavigate()

  const fetchAuthorInfo = (id: any) => {
    db.getInfo(db.types.auth, id)
      .then((response: any) => {
        setAuthorName(response.data.data.name)
      })
      .catch((error: any) => {
        console.error(error)
      })
  }

  const getAllNotesForAuthor = () => db.getAllNotesForAuthor(id)

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
