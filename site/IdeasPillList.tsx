import { useMemo, useState } from 'react'
import PillInput, { PillItem } from './PillInput'
import lightbulb from 'url:./icons/lightbulb.svg'

// Ideas as pills (see PillInput). Each add or remove fires its own
// callback so the parent can save it right away (notes save idea changes
// per action, not at "Done" time like authors). With fetchAiSuggestions,
// a lightbulb button adds AI-suggested ideas to the dropdown, tagged
// "AI"; picking one creates it.

interface IdeaLike {
  _id?: string
  name?: string | null
}

interface Props {
  value: IdeaLike[]
  onAddExisting: (idea: IdeaLike) => void
  onCreateNew: (name: string) => void
  onRemove: (ideaId: string) => void
  fetchAiSuggestions?: () => Promise<IdeaLike[]>
  // Esc with an empty input + closed dropdown calls this — typically used
  // to exit the wider "edit ideas" mode the parent is in.
  onExit?: () => void
  inputId?: string
  dontAutofocus?: boolean
}

export default function IdeasPillList(props: Props) {
  const { value } = props
  const [aiSuggestions, setAiSuggestions] = useState<PillItem[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  const handleFetchAi = async () => {
    if (!props.fetchAiSuggestions) return
    setAiLoading(true)
    try {
      const list = await props.fetchAiSuggestions()
      const takenNames = new Set(value.map((i) => i.name).filter(Boolean))
      setAiSuggestions(list.filter((i) => i.name && !takenNames.has(i.name)))
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  // Memoized: PillInput opens the dropdown whenever this list changes.
  const extraSuggestions = useMemo(
    () => aiSuggestions.map((item) => ({ item, tag: 'AI' })),
    [aiSuggestions]
  )

  // Adding anything clears the AI list, as before.
  const added = <T,>(fn: (x: T) => void) => (x: T) => {
    setAiSuggestions([])
    fn(x)
  }

  return (
    <PillInput
      type="idea"
      value={value}
      onAdd={added(props.onAddExisting)}
      onCreate={added(props.onCreateNew)}
      onRemove={(_, idea) => { if (idea._id) props.onRemove(idea._id) }}
      onExit={props.onExit}
      inputId={props.inputId ?? 'add-idea'}
      dontAutofocus={props.dontAutofocus}
      className="ideas"
      pillClassName="pill-idea"
      showYears
      extraSuggestions={extraSuggestions}
      controls={
        props.fetchAiSuggestions ? (
          <button
            type="button"
            className="pill-input-ai"
            onClick={handleFetchAi}
            disabled={aiLoading}
            tabIndex={-1}
            title="Suggest ideas"
            aria-label="Suggest ideas with AI"
          >
            <img src={lightbulb} alt="" />
          </button>
        ) : null
      }
    />
  )
}
