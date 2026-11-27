import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { afterAll, beforeAll, beforeEach } from 'vitest'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
  // Warm the app and its indexes here, inside the 60s hook budget, so the
  // first test in a file doesn't pay for module loads and index builds
  // inside its own 30s budget.
  await getApp()
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))
  // Keep background work out of tests: with a local OpenAI key configured,
  // every note save schedules a real embedding refresh two seconds later,
  // inside whatever test happens to be running by then. Files that test
  // AI behaviour set their own key in their own beforeAll, which is
  // registered after this one and so wins.
  const config = (await import('../src/config/index.js')).default
  config.secrets.openaikey = ''
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  // Clear all collections between tests for isolation. Ask the database
  // what collections it actually has: the Mongoose registry only knows
  // collections whose models have been imported so far, and anything
  // else (a raw insert, a lazily-registered model) survived the wipe.
  const db = mongoose.connection.db
  if (!db) return
  const collections = await db.listCollections({}, { nameOnly: true }).toArray()
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue
    await db.collection(name).deleteMany({})
  }
})

// Lazy-load app so env / mongoose are ready first
let _app
async function getApp() {
  if (!_app) {
    const mod = await import('../src/server.js')
    _app = mod.app
  }
  return _app
}

export async function api() {
  return request(await getApp())
}

// Password hashes for the fixture user, one per password. Cost 4, not
// the production 12: bcrypt is pure-JS CPU work on the same event loop
// as everything else, and at cost 12 one hash took ~274ms — with a
// registration in nearly every test, hashing alone was over half the
// suite's CPU and starved Mongo's connection monitor under load. The
// login endpoint compares against the stored hash, so a cheaper stored
// hash makes the real login below just as fast.
const fixtureHashes = new Map()
async function fixtureHash(password) {
  if (!fixtureHashes.has(password)) {
    fixtureHashes.set(password, await bcrypt.hash(password, 4))
  }
  return fixtureHashes.get(password)
}

// Sign in as the singleton 'commonplace' user and return a supertest
// agent with the auth cookie set. Seeds the user row directly, then
// goes through the real login endpoint so the session and cookie are
// the genuine article. The register endpoint itself is covered by the
// user and auth-middleware tests, which call it directly.
export async function authedAgent(password = 'testpass') {
  const app = await getApp()
  const { default: User } = await import('../src/resources/user/user.model.js')
  const hash = await fixtureHash(password)
  await User.updateOne(
    { username: 'commonplace' },
    { $setOnInsert: { username: 'commonplace', password: hash } },
    { upsert: true }
  )
  const agent = request.agent(app)
  await agent.post('/api/user/auth').send({ username: 'commonplace', password }).expect(201)
  return agent
}

// Fixture helpers — minimum-config entity creation. Use these in tests rather
// than hand-rolling so behavior stays consistent across resources.
export async function createAuthor(agent, name = 'Test Author') {
  const res = await agent.post('/api/auth/').send({ name }).expect(201)
  return res.body.data
}

export async function createWork(agent, { name = 'Test Work', authors = [] } = {}) {
  const res = await agent.post('/api/work/').send({ name }).expect(201)
  const work = res.body.data
  if (authors.length) {
    await agent.put(`/api/work/${work._id}`).send({ authors }).expect(200)
  }
  return work
}

export async function createIdea(agent, name = 'Test Idea') {
  const res = await agent.post('/api/idea/').send({ name }).expect(201)
  return res.body.data
}

export async function createPile(agent, name = 'Test Pile') {
  const res = await agent.post('/api/pile/').send({ name }).expect(201)
  return res.body.data
}

export async function createNote(agent, body = {}) {
  const res = await agent.post('/api/note/').send(body).expect(201)
  return res.body
}
