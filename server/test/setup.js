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
