# After deploying this batch

Steps for rolling out the batch of updates made on 2026-10-15 (about 90
commits). Work top to bottom. Delete this file once everything is done.

## 1. Before deploying: OpenAI key (deadline 2026-10-22)

OpenAI deactivates legacy user API keys on **October 22, 2026**. If the
Pi's key starts with `sk-` but not `sk-proj-`, it's one of them.

- [x] Create a new key at platform.openai.com/api-keys.
- [x] On the Pi, replace the key in `server/src/config/prodconfig.js`
      (or set `OPENAI_API_KEY` in `server/.env`, which overrides it).
- [x] Locally, replace the key in `server/src/config/devconfig.js`.
- [x] After deploying (step 2), check it: click **Suggest** next to a
      note's title.
- [x] Revoke the old key on the OpenAI dashboard.

Without a working key, OCR on upload, the OCR backlog task, title and
idea suggestions, and semantic search stop. Search itself keeps working
on keywords and names.

## 2. Deploy

- [x] Push `master` to GitHub. The commit messages close about 40 issues
      (`Fixes #N` / `Closes #N`). Note: **#313 will close** although
      authors and ideas weren't merged (we chose people tags instead);
      reopen it on GitHub if you still want the merge.
- [x] On the Pi: `git pull`, then rebuild and restart:
      ```
      docker-compose down
      docker-compose build
      docker-compose up -d
      ```
      The server rebuilds from source on start; the site must be rebuilt
      because it's built into its image. If the site looks stale, see
      "Howto and Debugging.md" (`docker-compose build --no-cache
      commonplace-site`).
- [x] On your Mac: `git pull` updates `cplace` (it runs `cli/cp.js` from
      the repo).

## 3. Run the maintenance tasks

Open **Maintenance** in the app (the sidebar shows "N maintenance tasks to
run", or type `maintenance` in the search bar). Run them in order; use
**Dry run** first. Details for each are in
[SCRIPTS_TO_RUN.md](SCRIPTS_TO_RUN.md).

- [x] 1. `trim-entity-names` (#51): trims stray spaces from names.
- [ ] Fix by hand what that task's output listed: rename or delete
      blank names, and merge names that now clash (e.g. two "Stoicism"
      ideas). The output is under the task on the Maintenance page.
- [x] 2. `add-work-ideas` (#216): optional tidy-up.
- [x] 3. `ocr-backlog` (#305): fills in text for old image notes. Uses
      OpenAI (needs the new key from step 1); the dry run shows how many
      calls.

## 4. Check things work

Skipped: not needed (the features were tested before deploying).

- [-] Search: a word, a quoted phrase, and a short-word phrase like
      "not at all" all find notes.
- [-] Upload an image to a note: the note's text fills in, and the file
      keeps its name (`1-photo.jpeg`, not `1-photoj.peg`).
- [-] A pile with more than 500 notes shows "p. 1 of N" with working
      arrows.
- [-] `cplace find <word>` and `cplace attach <note> <image>` work.

## 5. Recommended, not urgent

- [ ] **Close MongoDB's open port.** `docker-compose.yml` publishes
      `27017:27017` with no password, so anything on the home network can
      read or write the database. The server reaches Mongo over Docker's
      internal network, so removing that port mapping is enough (or add
      Mongo authentication).
- [ ] **Upgrade the Pi's MongoDB** from 4.4 (no security patches since
      Feb 2024). Not urgent; steps are in
      [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Things that changed behavior

So they don't surprise you:

- Name search matches the **start of words**: "all" no longer finds
  "Donald Hall"; "don ha" does.
- Enter in the search bar runs a search unless the text is a nick. With
  a modifier ("idea Stoic"), an exact name opens it, otherwise it
  searches that category.
- Escape now discards an unsaved edit of an author, idea, pile or work.
- `cplace note --json` prints the note object, not a one-item list.
- Short nick URLs work: `/n123456`, `/w…`, `/i…`, `/p…`.
