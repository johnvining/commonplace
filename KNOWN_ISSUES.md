# Known Issues

- **Intermittent test failures (about 1 full run in 5).** One test fails at random, never the same one: usually the first test in a file times out after 30s, or a request inside a test gets 401 (either "User already exists" on registering, or the login cookie isn't accepted right after registering). It never reproduced with a file run alone (pagination.test.js passed 20 of 20 alone), and it showed up more often when two vitest runs or browser checks ran at the same time. So it looks like state or timing leaking between test files in a full run, not a bug in the code under test. Leads: background work a test starts but doesn't await (embeddings, nicks, touch updates) landing after the next test's cleanup; `beforeEach` cleanup only clears collections for models registered so far. Rerunning the failed file always passes.

## Other open issues (larger / require design)

Not bug-list material, but worth keeping in mind: #340 (iPad), #329 (AI birth/death + timeline), #187 (timeline view), #162 (responsive note-full), #155 (note view types refactor), #108 (mobile styling), #100 (translate via OpenAI), #64 (kindle import).

- **Upgrade the Pi's MongoDB (on EOL 4.4.8).** Pinned in `docker-compose.yml`. MongoDB 4.4 EOL'd in Feb 2024; no upstream security patches. App works fine (nothing in the code needs a newer server), so not urgent, but worth upgrading in a maintenance window. Why it matters:
  - The port was open to the home network with no password; it's now bound to the Pi only (`127.0.0.1:27017`), so that risk is gone. Adding Mongo authentication would still be good practice.
  - **Future dependency bumps will force it.** Mongoose and the MongoDB driver drop old server versions over time; today's support 4.4, a future major may not. Upgrading on our own schedule beats doing it mid-dependency-bump.
  - **Tests run on Mongo 8.2** (mongodb-memory-server), production on 4.4. Nothing used today differs between them, but it's a blind spot until they match.

  How: **Use dump/restore (mongodump + mongorestore), not the in-place FCV version walk.** Concretely: with the old container running, `docker exec commonplace-mongo-1 mongodump --out=/data/db/dump-pre-upgrade`; `docker-compose down`; reset the `mongo-data` volume; bump image to `mongo:7.0` (LTS through July 2027) in docker-compose.yml; `docker-compose up -d`; `docker exec commonplace-mongo-1 mongorestore /data/db/dump-pre-upgrade`. Cost: brief downtime + doubled disk during transfer. **Critical rule:** never start a binary against data more than one major version older — doing so rewrites WiredTiger checkpoints into a format the older binaries can no longer read, locking you between FCV-too-old and WT-too-new. Dump/restore sidesteps this entirely because BSON is version-portable.
