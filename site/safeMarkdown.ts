import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Renders user-supplied markdown to HTML safe to inject via
// dangerouslySetInnerHTML. marked alone doesn't strip script/handler payloads,
// and notes/work summaries are arbitrary user text, so we always pass through
// DOMPurify before render.
//
// Keep this the single entry point for markdown → HTML.
//
// Pass { tabbableLinks: false } to keep the links out of the Tab order,
// e.g. in a note that isn't selected, so Tab moves from note to note.
export function renderMarkdown(
  input: string | null | undefined,
  { tabbableLinks = true }: { tabbableLinks?: boolean } = {}
): string {
  if (!input) return ''
  const raw = marked.parse(input, { async: false }) as string
  const html = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    // Block javascript:, data:, vbscript: URIs in href/src
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })
  // DOMPurify's output is normalized, so every link opens with "<a ".
  return tabbableLinks ? html : html.replace(/<a(?=[\s>])/g, '<a tabindex="-1"')
}
