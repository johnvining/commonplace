import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

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
  
  return (
    <>
      {props.authorName && (
        <span>
          {props.authorID ? (
            <a href={'/auth/' + props.authorID} onClick={handleAuthorClick} style={{ textDecoration: 'none' }}>
              {props.authorName}
            </a>
          ) : (
            props.authorName
          )}
        </span>
      )}
      {props.workTitle && props.authorName && <span>,&nbsp;</span>}
      {props.workTitle && props.workID && (
        <span className="italic">
          <a href={'/work/' + props.workID} onClick={handleWorkClick} style={{ textDecoration: 'none' }}>
            {props.workTitle}
          </a>
        </span>
      )}
      {props.workTitle && !props.workID && (
        <span className="italic">{props.workTitle}</span>
      )}
      {props.spaceAfter && <>&nbsp;</>}
    </>
  )
}

export default WorkCitationSpan
