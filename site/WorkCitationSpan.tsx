import { Link } from 'react-router-dom'

function WorkCitationSpan(props) {
  return (
    <>
      {props.authorName && (
        <span>
          {props.authorID && !props.plain ? (
            <Link to={'/auth/' + props.authorID} style={{ textDecoration: 'none' }}>
              {props.authorName}
            </Link>
          ) : (
            props.authorName
          )}
        </span>
      )}
      {props.workTitle && props.authorName && <span>,&nbsp;</span>}
      {props.workTitle && props.workID && !props.plain && (
        <Link to={'/work/' + props.workID} className="italic" style={{ textDecoration: 'none' }}>
          {props.workTitle}
        </Link>
      )}
      {props.workTitle && (props.plain || !props.workID) && (
        <span className="italic">{props.workTitle}</span>
      )}
      {props.spaceAfter && <>&nbsp;</>}
    </>
  )
}

export default WorkCitationSpan
