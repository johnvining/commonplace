import { useNavigate } from 'react-router-dom'

// A record's piles as chips that link to each pile. "Prefix: Name" piles
// show the prefix small. Editing piles is PilesPillList's job.
function PileListForItem(props: { piles?: any[]; allowTabbing?: boolean }) {
  const navigate = useNavigate()
  return (
    <>
      {props.piles?.map((pile: any) => {
        let pileName = pile.name
        let parts = pileName.split(':')
        let pre = ''
        if (parts.length > 1) {
          pileName = parts[1]
          pre = parts[0]
        }
        return (
          <button
            key={'/pile/' + pile._id}
            className="pile label"
            onClick={() => navigate('/pile/' + pile._id)}
            tabIndex={!props.allowTabbing ? -1 : undefined}
          >
            <>
              {pre ? <span className="pile pre">{pre}</span> : null}
              {pileName}
            </>
          </button>
        )
      })}
    </>
  )
}

export default PileListForItem
