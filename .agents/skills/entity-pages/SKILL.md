---
name: entity-pages
description: Build and review Commonplace entity pages (work, author, idea, pile, note) in the iOS/macOS apps so they match the website and each other.
---

# Entity Pages

Use this skill whenever creating or changing a detail page for an entity
(work, author, idea, pile, note) in `ios/Sources/CommonplaceApp/`.

The website (`site/Work.tsx`, `site/Author.tsx`, `site/Idea.tsx`,
`site/Pile.tsx`, note pages) is the reference. The apps match it as
closely as macOS/iOS conventions allow — serif content, small sans
controls — using shared components, never a per-page reinvention.

## Shared components (use these, do not rebuild per page)

- Header: `EntityPageHeader` — title, byline, nick on the left; action
  buttons (`DSButton`, `OpenInWebButton`) on ONE right-aligned row.
- A work in any list: `WorkListRow` — book icon, "Names, *Title*
  (Original) Year", the work's own star at the right edge.
- A note in any list: `NoteRow` / `NoteFlowRow`.
- Author lists in text: `joinAuthorNames` ("A & B", "A, B & C").

## Rules

1. No section heading over the main works or notes list — the web
   lists them directly under the header. Headings only for meaningful
   groups (Edited, Translated, Notes about).
2. Header buttons stay right-aligned on one row at any window width.
3. Navigation stays in the main window: selections route the split
   view's detail (the quick bar is the model — an overlay, never a
   sheet or a new window for ordinary navigation).
4. Fix patterns in the shared component, once — never patch one page
   at a time.

## Verify before calling it done

1. Build: `ios/build.sh mac` and `ios/build.sh ios` both succeed.
2. Open one item of each entity type in the running Mac app and
   compare against the same item on the website: header alignment,
   no stray headings, work-row composition, per-work star behaviour,
   notes rows.
3. Check a narrow window width as well as wide: header buttons must
   stay right-aligned and on one row.
4. Server changes go in their own commit; say what was checked.
