import PillInput from './PillInput'

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

// Split a `Prefix: Name` pile name into `{ pre, label }`. If there is no
// colon, returns the whole name as the label.
function splitPileName(name: string | null | undefined): { pre: string | null; label: string } {
  if (!name) return { pre: null, label: '' }
  const idx = name.indexOf(':')
  if (idx < 0) return { pre: null, label: name }
  return { pre: name.slice(0, idx).trim(), label: name.slice(idx + 1).trim() }
}

function PileLabel({ name }: { name?: string | null }) {
  const { pre, label } = splitPileName(name)
  return (
    <>
      {pre ? <span className="pill-pre">{pre}</span> : null}
      <span>{label}</span>
    </>
  )
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
