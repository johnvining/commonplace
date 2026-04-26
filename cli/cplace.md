Search, read, and add to the Commonplace knowledge base using the `cplace` CLI.

## What Commonplace is

A personal knowledge base of notes (quotes, ideas, passages), organised by author, work, idea tag, and pile (collection). Notes can have text, images, URLs, and short nicknames.

## How to use this skill

Use `cplace` commands to answer questions, retrieve context, or capture new notes. Always show the user what you found or did.

### Search
```bash
cplace search <query>
```
Returns a ranked mix of notes, authors, works, ideas, and piles. Use this first for any lookup.

### Read a note in full
```bash
cplace note <id>
```

### Recent notes
```bash
cplace recent [page]
```

### Look up by nick (short name)
```bash
cplace nick <nick>
```

### Search specific entity types
```bash
cplace authors <query>
cplace works <query>
cplace ideas <query>
cplace piles <query>
```

### Add a note (opens browser)
```bash
cplace add "<title>"
```
Creates the note and opens it in the browser for editing.

### Quick-capture (no browser)
```bash
cplace quick "<title>"
```
Creates a note silently and prints the ID. Use this when capturing from within a conversation.

### Capture with metadata
```bash
cplace capture "<title>" [--text "body"] [--author "Name"] [--work "Title"] [--idea "tag1,tag2"] [--pile "pile name"]
```
Creates a note and links author, work, ideas, and/or pile in one step. Author and work are resolved by autocomplete (created if not found). Multiple ideas are comma-separated. Add `--json` for machine-readable output.

### Stats
```bash
cplace stats
```
Shows total counts for notes, authors, works, ideas, and piles.

### Update metadata on an existing note
```bash
cplace set <id> [--author "Name"] [--work "Title"] [--idea "tag1,tag2"] [--pile "Name"] [--title "T"] [--text "T"]
```
Links or creates author/work/ideas/pile on an existing note. Also updates title or text inline.

### Edit a note field (simple)
```bash
cplace edit <id> title "New title"
cplace edit <id> text "Note body text"
```

### Random notes
```bash
cplace flip
```

### Config
```bash
cplace config                # show current URL and auth status
cplace config url http://... # set server URL
```

### Check server status
```bash
cplace ping
```
If the server is not running, say so clearly and stop — do not fabricate results.

## Behavioural rules

- **Always run `cplace ping` first** if there is any doubt the server is up.
- **Never invent note content.** Only report what `cplace` actually returns.
- **Show IDs** when listing results so the user can follow up.
- If the user asks you to "save", "note", "capture", or "remember" something, use `cplace capture` (with `--author`/`--work`/`--idea` if known) or `cplace quick` for plain titles.
- If the user asks what they know about a topic, use `cplace search`.
- Keep output tight — don't paste entire note bodies unless asked.
- If a search returns nothing useful, say so and suggest a narrower or different query.

## Example interactions

> "What do I have on Shakespeare?"
> → `cplace search Shakespeare`

> "Show me that note on attention"
> → `cplace search attention` then `cplace note <id>` on the best match

> "What authors have I read?"
> → `cplace authors ""` or `cplace search <topic>`
