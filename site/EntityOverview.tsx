import { renderMarkdown } from './safeMarkdown'

// An idea's or pile's overview notes (#317), rendered as markdown under
// the page header. Open by default, unlike a work's summary: reading it
// is the point of writing it.
export default function EntityOverview({ text }: { text?: string | null }) {
  if (!text?.trim()) return null
  return (
    <details className="work-summary-collapse" open>
      <summary>Overview</summary>
      <div
        className="work-summary-content work-summary"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
      />
    </details>
  )
}
