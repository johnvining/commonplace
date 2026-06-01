import { Link } from 'react-router-dom'
import { joinAuthorNames, AuthorLike } from './authorsDisplay'

// Renders one or more authors followed by a work title.
//
// - `authors`: ordered list of populated author objects (preferred).
// - `authorName` / `authorID`: legacy single-author props, treated as a
//   one-entry authors list. Deprecated — call sites should pass `authors`.
//
// In plain mode (no links), all authors are joined into a single string;
// otherwise each author renders as a Link, with comma/ampersand separators.

interface Props {
  authors?: AuthorLike[] | null
  // Legacy single-author shape, retained while call sites migrate.
  authorName?: string | null
  authorID?: string | null
  workTitle?: string | null
  workID?: string | null
  plain?: boolean
  // Truthy → render a trailing &nbsp;. Accepts any value (strings, numbers,
  // booleans) so callers can pass `year || url`-style expressions without
  // an extra !! cast.
  spaceAfter?: unknown
}

function normaliseAuthors(props: Props): AuthorLike[] {
  if (props.authors && props.authors.length) return props.authors
  if (props.authorName) {
    return [{ _id: props.authorID ?? undefined, name: props.authorName }]
  }
  return []
}

function AuthorsRender({ authors, plain }: { authors: AuthorLike[]; plain?: boolean }) {
  if (plain) return <span>{joinAuthorNames(authors)}</span>
  return (
    <span>
      {authors.map((a, i) => {
        const sep = i === 0 ? null : i === authors.length - 1 ? ' & ' : ', '
        const hasLink = a._id && a.name
        return (
          <span key={a._id ?? i}>
            {sep}
            {hasLink ? (
              <Link to={'/auth/' + a._id} style={{ textDecoration: 'none' }}>
                {a.name}
              </Link>
            ) : (
              a.name
            )}
          </span>
        )
      })}
    </span>
  )
}

function WorkCitationSpan(props: Props) {
  const authors = normaliseAuthors(props)
  const hasAuthors = authors.length > 0

  return (
    <>
      {hasAuthors && <AuthorsRender authors={authors} plain={props.plain} />}
      {props.workTitle && hasAuthors && <span>,&nbsp;</span>}
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
