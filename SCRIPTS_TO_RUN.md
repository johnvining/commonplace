# Scripts to run

One-off scripts to run against the real database once the current batch of
updates is deployed. Run them in order, after the new server is up. Each is
safe to run twice. Delete an entry once it has been run.

Commands are for local Mongo; on the Pi, pipe the same file into the mongo
container instead:

```
docker exec -i $(docker ps -qf name=mongo) mongo commonplace --quiet < scripts/<file>.js
```

## 1. Trim entity names (#51)

```
mongosh commonplace --quiet < scripts/trim-entity-names.js
```

Trims stray spaces from author, work, idea and pile names. Without it, a name
stored as `" Stoicism"` can't be found by exact-name lookups and the next
import makes a duplicate. Prints blank-named records and names that now clash;
fix those by hand in the app.

## 2. Give works an ideas array (#216)

```
mongosh commonplace --quiet < scripts/add-work-ideas.js
```

Optional. Mongoose already treats a missing array as empty; this makes the raw
collection consistent.

## 3. OCR the image-note backlog (#305)

```
cd server
npm run ocr-backlog -- --dry-run      # shows notes and OpenAI calls needed
npm run ocr-backlog                   # or --limit 20 to do the newest first
```

Fills in the text of image notes that have none. Uses OpenAI (one call per
image not already read); notes with text are never touched.
