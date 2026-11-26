import PillInput from './PillInput'
import PileName from './PileName'

// Piles as pills (see PillInput). Each add or remove fires its own
// callback so the parent can save it right away. Pills show the
// "Prefix: Name" convention with the prefix as a small tag.

interface PileLike {
  _id?: string
  name?: string | null
}

interface Props {
  value: PileLike[]
  onAddExisting: (pile: PileLike) => void
  onCreateNew: (name: string) => void
  onRemove: (pileId: string) => void
  // Esc with an empty input + closed dropdown — typically exits the parent's
  // "edit piles" mode.
  onExit?: () => void
  inputId?: string
  dontAutofocus?: boolean
  compact?: boolean
}

// Pile labels render through the one PileName component everywhere
// (display tags, list rows, titles, and these pills), so the prefix
// key looks identical in every context.
export function PileLabel({ name }: { name?: string | null }) {
  return <PileName name={name ?? undefined} />
}

export default function PilesPillList(props: Props) {
  return (
    <PillInput
      type="pile"
      value={props.value}
      onAdd={props.onAddExisting}
      onCreate={props.onCreateNew}
      onRemove={(_, pile) => { if (pile._id) props.onRemove(pile._id) }}
      onExit={props.onExit}
      inputId={props.inputId ?? 'add-pile'}
      dontAutofocus={props.dontAutofocus}
      className={'piles' + (props.compact ? ' compact' : '')}
      pillClassName="pill-pile"
      renderName={(pile) => <PileLabel name={pile.name} />}
    />
  )
}
