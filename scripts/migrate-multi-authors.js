// Migrate single `author: ObjectId` → ordered `authors: ObjectId[]` on
// notes and works.
//
// Idempotent: the `{ author: { $exists: true } }` filter only matches
// docs that still carry the old field, so re-running is a no-op.
//
// Compatible with both legacy `mongo` shell (Pi runs mongo:4.4) and
// modern `mongosh` (local 8.x). The aggregation-pipeline form of
// updateMany requires Mongo 4.2+ on the server, which both versions
// satisfy.
//
// Usage:
//   local:  mongosh commonplace --quiet < scripts/migrate-multi-authors.js
//   Pi:     docker exec -i $(docker ps -qf name=mongo) \
//             mongo commonplace --quiet < scripts/migrate-multi-authors.js
//
// To reverse (in case something goes wrong before code is fully migrated):
//   uncomment the REVERSE block at the bottom and re-run.

const notes = db.notes.updateMany(
  { author: { $exists: true } },
  [
    {
      $set: {
        authors: {
          $cond: [{ $ifNull: ['$author', false] }, ['$author'], []],
        },
      },
    },
    { $unset: 'author' },
  ]
)
print('notes:  matched=' + notes.matchedCount + '  modified=' + notes.modifiedCount)

const works = db.works.updateMany(
  { author: { $exists: true } },
  [
    {
      $set: {
        authors: {
          $cond: [{ $ifNull: ['$author', false] }, ['$author'], []],
        },
      },
    },
    { $unset: 'author' },
  ]
)
print('works:  matched=' + works.matchedCount + '  modified=' + works.modifiedCount)

// Backfill `authors: []` on docs that never had a single-author field so the
// new schema's required field always exists. Skips anything already migrated.
const notesNoAuthors = db.notes.updateMany(
  { authors: { $exists: false } },
  { $set: { authors: [] } }
)
print('notes (backfill empty):  matched=' + notesNoAuthors.matchedCount + '  modified=' + notesNoAuthors.modifiedCount)

const worksNoAuthors = db.works.updateMany(
  { authors: { $exists: false } },
  { $set: { authors: [] } }
)
print('works (backfill empty):  matched=' + worksNoAuthors.matchedCount + '  modified=' + worksNoAuthors.modifiedCount)

// --- REVERSE migration (uncomment to roll back) ---
//
// const notesRev = db.notes.updateMany(
//   { authors: { $exists: true } },
//   [
//     { $set: { author: { $arrayElemAt: ['$authors', 0] } } },
//     { $unset: 'authors' },
//   ]
// )
// print('reverse notes: matched=' + notesRev.matchedCount + ' modified=' + notesRev.modifiedCount)
//
// const worksRev = db.works.updateMany(
//   { authors: { $exists: true } },
//   [
//     { $set: { author: { $arrayElemAt: ['$authors', 0] } } },
//     { $unset: 'authors' },
//   ]
// )
// print('reverse works: matched=' + worksRev.matchedCount + ' modified=' + worksRev.modifiedCount)
