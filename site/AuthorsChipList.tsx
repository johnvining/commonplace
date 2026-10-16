import * as db from './Database'
import { AuthorLike } from './authorsDisplay'
import PillInput from './PillInput'

// Ordered, editable list of authors as pills (see PillInput). Changes go
// to onChange as a whole list, saved by the parent with the rest of the
// form. Order is significant (citation order); new authors append.
// Typing a name with no match creates the author.

interface Props {
  value: AuthorLike[]
  onChange: (next: AuthorLike[]) => void
  // Esc with an empty input + closed dropdown calls this — typically used
  // to exit the wider "edit" mode the parent is in.
  onExit?: () => void
  inputId?: string
  dontAutofocus?: boolean
}

export default function AuthorsChipList(props: Props) {
  const { value, onChange } = props

  const append = (author: AuthorLike) => {
    if (!author?._id || value.some((a) => a._id === author._id)) return
    onChange([...value, author])
  }

  const createAndAppend = async (name: string) => {
    try {
      const res: any = await db.createRecord('auth', name)
      const created: AuthorLike | undefined = res?.data?.data
      if (created?._id) append(created)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error(e)
    }
  }

  return (
    <PillInput
      type="auth"
      value={value}
      onAdd={append}
      onCreate={createAndAppend}
      onRemove={(index) => onChange(value.filter((_, i) => i !== index))}
      onExit={props.onExit}
      inputId={props.inputId ?? 'add-author'}
      dontAutofocus={props.dontAutofocus}
      showYears
    />
  )
}
