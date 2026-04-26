import React from 'react'
import { useNavigate } from 'react-router-dom'

function WorkCitationSpan(props) {
  const navigate = useNavigate()

  const handleAuthorClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (props.authorID) {
      navigate('/auth/' + props.authorID)
    }
  }

  const handleWorkClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (props.workID) {
      navigate('/work/' + props.workID)
    }
  }

  const linkStyle = { cursor: 'pointer', textDecoration: 'none' }

  return (
    <>
      {props.authorName && (
        <span>
          {props.authorID && !props.plain ? (
            <span onClick={handleAuthorClick} style={linkStyle}>
              {props.authorName}
            </span>
          ) : (
            props.authorName
          )}
        </span>
      )}
      {props.workTitle && props.authorName && <span>,&nbsp;</span>}
      {props.workTitle && props.workID && !props.plain && (
        <span className="italic">
          <span onClick={handleWorkClick} style={linkStyle}>
            {props.workTitle}
          </span>
        </span>
      )}
      {props.workTitle && (props.plain || !props.workID) && (
        <span className="italic">{props.workTitle}</span>
      )}
      {props.spaceAfter && <>&nbsp;</>}
    </>
  )
}

export default WorkCitationSpan
