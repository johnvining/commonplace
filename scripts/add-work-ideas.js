// Give every work an empty `ideas` array (#216).
//
// Mongoose already treats a missing array as empty, so this is for
// consistency: queries and tools reading the raw collection see the same
// shape on every work.
//
// Idempotent: only works without the field are updated.
//
// Usage:
//   local:  mongosh commonplace --quiet < scripts/add-work-ideas.js
//   Pi:     docker exec -i $(docker ps -qf name=mongo) \
//             mongo commonplace --quiet < scripts/add-work-ideas.js

const works = db.works.updateMany(
  { ideas: { $exists: false } },
  { $set: { ideas: [] } }
)
print('works:  matched=' + works.matchedCount + '  modified=' + works.modifiedCount)
