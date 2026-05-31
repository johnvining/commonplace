# Multi-Authors — Implementation Plan

Closes #109 (Support multiple authors per work/note).

## Goal

Replace the single `author: ObjectId` field on `Note` and `Work` with an ordered
`authors: ObjectId[]`. Preserve today's single-author UX as the default; preserve
the note-inherits-work-author fallback.

## Design choices

- **One field, ordered array.** `author?: ObjectId` → `authors: ObjectId[]`.
  Order matters (citation order). Empty array = no author.
- **No transitional dual-field.** Single-shot schema swap + one-time migration.
  Cleaner code for a single-user deploy.
- **Inheritance preserved.** Where today's code reads
  `note.author ?? note.work?.author`, the new code reads
  `note.authors?.length ? note.authors : note.work?.authors`.
- **Mongo queries.** `{ author: id }` → `{ authors: id }`. Mongo's array-element
  match handles the lookup without `$in` / `$elemMatch` rewrites.

## Stages (each its own commit)

1. **Schema + types.** `note.model.ts`, `work.model.ts`, `types/` updates.
   Replace `author?: ObjectId` with `authors: ObjectId[]`. Update indexes.
2. **Migration script.** `scripts/migrate-multi-authors.js` — mongosh
   aggregation pipeline, idempotent, prints counts. Compatible with mongo:4.4
   (Pi) and mongosh 8.x (local).
3. **Backend sweep.** Controllers (`note`, `work`, `auth`, `stats`),
   `embeddings.ts`, writable whitelists (`NOTE_WRITABLE`, `WORK_WRITABLE`),
   cli/import.ts. Most are one-line swaps. Cascade-delete on Author becomes
   `Note.updateMany({ authors: id }, { $pull: { authors: id } })`.
4. **Backend tests.** Update fixtures from `author: id` to `authors: [id]`.
   Add coverage for: multi-author add, multi-author remove, inheritance fallback,
   cascade-delete with `$pull`.
5. **Frontend display.** `WorkCitationSpan`, `NoteSlim`, `NoteResult`,
   `ResultWork`, `Stats`, etc. Render multi-author lists:
   - 1 author: `Smith, J.`
   - 2 authors: `Smith, J. & Jones, A.`
   - 3+: `Smith, J., Jones, A. & Brown, B.` (no "et al." — full list)
6. **Frontend editor.** `Note.tsx` and `Work.tsx` editor sections: replace
   single-author autocomplete with author chips + autocomplete to add another.
   Reorder via up/down arrows (not drag — simpler, fewer deps).
7. **Cleanup.** Remove any unused state (`pendingAuthorId` / `pendingAuthorName`
   patterns), regenerate types if needed.

## Migration & deploy plan

Tracked at `scripts/migrate-multi-authors.js`. Idempotent — `{ author: { $exists: true } }` filter only matches un-migrated docs; re-runs are no-ops.

**Local first:**
```
mongosh commonplace --quiet < scripts/migrate-multi-authors.js
```

**On the Pi (after code changes are pulled and images rebuilt):**
```
docker-compose build commonplace-server commonplace-site
docker-compose stop commonplace-server commonplace-site   # mongo + ngrok stay up
docker exec $(docker ps -qf name=mongo) mongodump --db commonplace --out /data/db/backup-pre-multi-authors
docker exec -i $(docker ps -qf name=mongo) mongo commonplace --quiet < scripts/migrate-multi-authors.js
docker-compose up -d
```

Pi runs mongo:4.4 → uses legacy `mongo` shell (not `mongosh`, which only ships
in 5.0+). The aggregation-pipeline `updateMany` syntax works in both.

## Reversibility

A reverse pipeline (set `author` from first element of `authors`, unset `authors`)
will live in the same script file behind a comment, so we can run it if anything
goes sideways. Plus the `mongodump` snapshot from above.

## Open style choices (resolved)

- **Citation format for 3+ authors:** full list with `&` before last (no "et al.").
- **Reorder UI:** up/down arrows on each chip.
- **Migration safety:** local first, verify, then Pi.
