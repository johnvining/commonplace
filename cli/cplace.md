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
cplace capture "<title>" [--author "Name"] [--work "Title"] [--idea "tag1,tag2"] [--pile "pile name"]
```
Creates a note and links author, work, ideas, and/or pile in one step. Author and work are resolved by autocomplete (created if not found). Multiple ideas are comma-separated.

### Stats
```bash
cplace stats
```
Shows total counts for notes, authors, works, ideas, and piles.

### Edit a note field
```bash
cplace edit <id> title "New title"
cplace edit <id> text "Note body text"
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

> "What do I have on Seneca?"
> → `cplace search Seneca`

> "Show me that note on attention"
> → `cplace search attention` then `cplace note <id>` on the best match

> "Save this: Marcus Aurelius says the obstacle is the way"
> → `cplace capture "The obstacle is the way" --author "Marcus Aurelius"`

> "Note that Seneca says time is the only true capital in Letters from a Stoic"
> → `cplace capture "Time is the only true capital" --author "Seneca" --work "Letters from a Stoic"`

> "What authors have I read?"
> → `cplace authors ""` or `cplace search <topic>`
