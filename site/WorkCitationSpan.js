import React from 'react'
import { Link } from 'react-router-dom'

function WorkCitationSpan(props) {
  return (
    <>
      {props.authorName && (
        <span>
          <Link to={'/auth/' + props.authorID}>{props.authorName}</Link>
        </span>
      )}
      {props.workTitle && props.authorName && <span>,&nbsp;</span>}
      {props.workTitle && props.workID && (
        <span>
          <Link to={'/work/' + props.workID}>{props.workTitle}</Link>
        </span>
      )}
      {props.workTitle && !props.workID && <span>{props.workTitle}</span>}
      {props.spaceAfter && <>&nbsp;</>}
    </>
  )
}

export default WorkCitationSpan
