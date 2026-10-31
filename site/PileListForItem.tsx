import { useNavigate } from 'react-router-dom'
import PileName, { splitPileName } from './PileName'

// A record's piles as tags that link to each pile. "Prefix: Name" piles
// show the prefix as a key (see PileName). Editing piles is PilesPillList's
// job.
function PileListForItem(props: { piles?: any[]; allowTabbing?: boolean }) {
  const navigate = useNavigate()
  return (
    <>
      {props.piles?.map((pile: any) => {
        const keyed = !!splitPileName(pile.name).pre
        return (
          <button
            key={'/pile/' + pile._id}
            className={'pile label' + (keyed ? ' keyed' : '')}
            onClick={() => navigate('/pile/' + pile._id)}
            tabIndex={!props.allowTabbing ? -1 : undefined}
          >
            <PileName name={pile.name} />
          </button>
        )
      })}
    </>
  )
}

export default PileListForItem
