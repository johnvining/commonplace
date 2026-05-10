# Known Issues

## TypeScript: enable `strict: true` after migration

**Status.** Both `server/tsconfig.json` and `site/tsconfig.json` currently run with `strict: false`. This was a deliberate migration choice — flipping strict on surfaces ~71 errors in the server alone, mostly from `strictNullChecks` (Mongoose `findOne()` can return null but the code accesses properties without checking) and `let foo = []` inferred as `never[]` then pushed into.

**Suggested fix.** Tighten in stages:
1. Enable `strict` on the server, with `noImplicitAny: false` to keep the migration's `: any` parameters. Fix null-check sites by adding guards or `!` assertions where invariant; type empty arrays explicitly (`const promises: Promise<X>[] = []`).
2. Repeat on the site. Most class component states and function-component props are typed `: any` — Phase 3 work item to type them properly.
3. Once strict-clean, drop `noImplicitAny: false` and address the residual `: any` decorations on parameters.

The biggest cluster of `: any` casts in the server is in `note.controllers.ts` — these mostly handle runtime augmentations (`note.nick`, `_hybridScore`) on lean Mongoose results. The `PopulatedNote` type at the top of that file already captures these; further tightening means propagating it through the helper functions that currently take/return `any`.



Issues discovered during cleanup and TypeScript migration that are out of scope for the immediate task. Each entry has the symptom, the root cause, and a suggested fix so they can be picked up cleanly later.

## Frontend `getNoteByNick` is broken — backend route does not exist

**Symptom.** `NoteView.js:15` calls `db.getNoteByNick(nick)` when a route like `/note/<nick>` is hit. The frontend [`getNoteByNick`](site/Database.js) issues `GET /api/note/nick/:nick`, but `server/src/resources/note/note.router.js` has no route for `/nick/:nick`. The request falls through to `GET /api/note/:id` (where `:id` is captured as the literal nick), which then 400s because `findNotesAndPopulate({_id: nick})` cannot cast a nick string to an ObjectId.

**Suggested fix.** Either:
- Add a backend route `router.route('/nick/:nick').get(...)` that resolves the nick → noteId via the `Nick` collection and returns the populated note. This is the most direct fix and matches the frontend contract.
- Or rewrite the frontend flow to first hit `GET /api/nick/:nick` (which exists) to resolve the nick → noteId, then fetch via `GET /api/note/:noteId`.

## `res.clearCookie` deprecation warning on logout

**Symptom.** Express prints a deprecation warning every time `POST /api/user/logout` runs:

> `res.clearCookie: Passing "options.maxAge" is deprecated. In v5.0.0 of Express, this option will be ignored, as res.clearCookie will automatically set cookies to expire immediately.`

**Root cause.** [`user.controllers.js:reqLogout`](server/src/resources/user/user.controllers.js) calls `res.clearCookie('jwt', cookieOptions(config))`, and `cookieOptions` includes `maxAge`. `clearCookie` builds its own expiry — `maxAge` is meaningless there.

**Suggested fix.** Pass only the cookie attributes that affect *which* cookie is being cleared (`httpOnly`, `sameSite`, `secure`, `path`) — drop `maxAge`. Easiest is a separate helper `clearCookieOptions(config)` that returns the same object minus `maxAge`.

## asyncWrapper double-responds on default `updateOne`

**Symptom.** Routes wired as `router.route('/:id').put(asyncWrapper(defaultControllers.updateOne, 200))` cause Express to log a "Cannot set headers after they are sent" warning under the hood. The client sees the right response, so it's invisible from the outside, but it's a latent bug.

**Root cause.** [`default.controllers.js:updateOne`](server/src/utils/default.controllers.js) calls `res.status(200).end()` itself, but [`asyncWrapper`](server/src/utils/requests.js) then also calls `res.status(successCode).json({data})` on the same response. The second call fails silently after headers are already sent.

**Suggested fix.** Make `defaultControllers.updateOne` return the updated document (or `null`) instead of writing to `res` directly, matching the pattern of `getOne`. Then `asyncWrapper` is the single source of response.

## Hardcoded secrets in `devconfig.js`

**Status.** `server/src/config/devconfig.js` is gitignored (verified — see `.gitignore`), so the JWT secret and OpenAI keys are not in the public repo. But they live unencrypted on disk.

**Suggested fix.** Move secrets to environment variables (or a `.env` file with `dotenv`, which is already in deps). The config layer would read from `process.env.JWT_SECRET`, `process.env.OPENAI_API_KEY`, etc.

## Internal `server/src/cli/cli.ts` is broken / stale

**Symptom.** `server/src/cli/cli.ts` (run via `npm run cli`) references identifiers that don't exist in the current codebase: `getTenMostRecentNotes`, `addIdeaToID`, bare `database`, `schemata`, `i`. The file would crash at runtime if invoked.

**Suggested fix.** Either rewrite to the current controller surface or delete entirely. The user-facing CLI is `cplace` in `cli/cp.js` — that one is alive and well. The internal one in `server/src/cli/` looks superseded.

For now `// @ts-nocheck` is on the file so the TS migration can proceed.

## `cli/cp.js` and `cli/import.js` reference `utils.guessYearFromURL` (uppercase URL) which doesn't exist

**Symptom.** `server/src/cli/import.ts` calls `utils.guessYearFromURL(url)` but the actual export in `server/src/utils/urls.ts` is `guessYearFromUrl` (lowercase `Url`). The call returns undefined. Year-from-URL inference doesn't work in CSV imports.

**Suggested fix.** Either rename the export to match (`guessYearFromURL`) or fix the callers to use `guessYearFromUrl`. Watch out for the namespace import at the top: `import * as utils from '../utils'` — that's importing from a directory, not from `urls.ts`, so it's broken too. The proper import is `import { guessYearFromUrl } from '../utils/urls'`.

## Cookie behavior is environment-aware in a way that breaks tests by default

**Symptom.** When `NODE_ENV !== 'development'`, the JWT cookie is set with `secure: true`. Vitest defaults `NODE_ENV` to `'test'`, which silently breaks all authenticated requests in tests because supertest doesn't use HTTPS.

**Workaround in place.** `npm test` overrides with `NODE_ENV=development` ([`server/package.json`](server/package.json)).

**Suggested fix.** The config layer should treat `'test'` as a non-production env (i.e. `isDev: env === 'development' || env === 'test'`), or there should be an explicit `isProd` flag instead of inverting `isDev`.
