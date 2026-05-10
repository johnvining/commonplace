# Known Issues

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

## Cookie behavior is environment-aware in a way that breaks tests by default

**Symptom.** When `NODE_ENV !== 'development'`, the JWT cookie is set with `secure: true`. Vitest defaults `NODE_ENV` to `'test'`, which silently breaks all authenticated requests in tests because supertest doesn't use HTTPS.

**Workaround in place.** `npm test` overrides with `NODE_ENV=development` ([`server/package.json`](server/package.json)).

**Suggested fix.** The config layer should treat `'test'` as a non-production env (i.e. `isDev: env === 'development' || env === 'test'`), or there should be an explicit `isProd` flag instead of inverting `isDev`.
