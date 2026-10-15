// Trim stored names on authors, works, ideas and piles, and list any with
// a blank name.
//
// Names are now required and trimmed by the schema (#51). Mongoose also
// trims query values, so a name stored with stray spaces (" Stoicism")
// can no longer be found by exact-name lookups, and find-or-create would
// make a duplicate. Run this once to bring stored names in line.
//
// Blank-named records are only listed, never deleted: notes may still
// point at them. Rename or delete them in the app.
//
// Idempotent: only names with leading/trailing whitespace are updated.
//
// Usage:
//   local:  mongosh commonplace --quiet < scripts/trim-entity-names.js
//   Pi:     docker exec -i $(docker ps -qf name=mongo) \
//             mongo commonplace --quiet < scripts/trim-entity-names.js

const collections = ['auths', 'works', 'ideas', 'piles']

collections.forEach(function (name) {
  const coll = db.getCollection(name)

  const trimmed = coll.updateMany(
    { name: { $type: 'string', $regex: /^\s|\s$/ } },
    [{ $set: { name: { $trim: { input: '$name' } } } }]
  )

  const blank = coll
    .find({ $or: [{ name: { $exists: false } }, { name: null }, { name: /^\s*$/ }] }, { _id: 1 })
    .toArray()

  print(
    name + ':  trimmed=' + trimmed.modifiedCount +
    '  blank=' + blank.length +
    (blank.length ? '  ids=' + blank.map(function (d) { return d._id.str || String(d._id) }).join(',') : '')
  )
})

// Names that now collide after trimming (e.g. "Stoicism" and " Stoicism")
// are left for you to merge; list them so they're easy to find.
collections.forEach(function (name) {
  const dupes = db.getCollection(name).aggregate([
    { $match: { name: { $type: 'string', $ne: '' } } },
    { $group: { _id: '$name', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray()
  if (dupes.length) {
    print(name + ' duplicate names: ' + dupes.map(function (d) { return JSON.stringify(d._id) + ' x' + d.count }).join(', '))
  }
})
