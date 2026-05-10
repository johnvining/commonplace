import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach } from 'vitest'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  // Clear all collections between tests for isolation
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({})
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

// Register the singleton 'commonplace' user (the only valid registration)
// and return a supertest agent with auth cookie set.
export async function authedAgent(password = 'testpass') {
  const app = await getApp()
  const agent = request.agent(app)
  await agent.put('/api/user/').send({ username: 'commonplace', password }).expect(201)
  return agent
}

// Fixture helpers — minimum-config entity creation. Use these in tests rather
// than hand-rolling so behavior stays consistent across resources.
export async function createAuthor(agent, name = 'Test Author') {
  const res = await agent.post('/api/auth/').send({ name }).expect(201)
  return res.body.data
}

export async function createWork(agent, { name = 'Test Work', author = null } = {}) {
  const res = await agent.post('/api/work/').send({ name }).expect(201)
  const work = res.body.data
  if (author) {
    await agent.put(`/api/work/${work._id}`).send({ author }).expect(200)
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
