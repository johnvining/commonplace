import PileName from './PileName'
import circle from 'url:./icons/circle.svg'
import check_circle from 'url:./icons/check_circle.svg'

// Pieces shared by the compact note views (slim, grid, tile), which all
// take the same props from NoteList (#155):
//   note, id, index, selected, deleted, tabIndex,
//   markChecked(index), markShiftChecked(index)
export interface CompactNoteProps {
  note: any
  id: string
  index: number
  selected?: boolean
  deleted?: boolean
  tabIndex?: number
  markChecked: (index: number) => void
  markShiftChecked: (index: number) => void
}

// The circle that selects a note for multi-select; Shift extends the
// selection from the last one touched.
export function SelectToggle(props: CompactNoteProps) {
  return (
    <button
      onClick={(e) => (e.shiftKey ? props.markShiftChecked(props.index) : props.markChecked(props.index))}
      className="button grid-button"
      title="Select (x)"
      tabIndex={-1}
    >
      <img src={props.selected ? check_circle : circle} />
    </button>
  )
}

// "[2 images] ", or nothing
export function imageCountLabel(count: number | undefined) {
  if (!count) return null
  return '[' + count + ' image' + (count == 1 ? '' : 's') + '] '
}

export function NoteTags({ note, id }: { note: any; id: string }) {
  return (
    <>
      {note.piles?.map((pile: any, idx: any) => (
        <span className="pile" key={'pile-' + id + idx}>
          <PileName name={pile.name} />
        </span>
      ))}
      {note.ideas?.map((idea: any, idx: any) => (
        <span className="idea" key={'idea-' + id + idx}>
          {idea.name}
        </span>
      ))}
    </>
  )
}
