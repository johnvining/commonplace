import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Renders user-supplied markdown to HTML safe to inject via
// dangerouslySetInnerHTML. marked alone doesn't strip script/handler payloads,
// and notes/work summaries are arbitrary user text, so we always pass through
// DOMPurify before render.
//
// Keep this the single entry point for markdown → HTML.
export function renderMarkdown(input: string | null | undefined): string {
  if (!input) return ''
  const raw = marked.parse(input, { async: false }) as string
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    // Block javascript:, data:, vbscript: URIs in href/src
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })
}
