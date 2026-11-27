import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { authedAgent } from './setup.js'

// Test isolation contract: whatever one test leaves in the database —
// through a model or through a collection no model has registered yet —
// the next test must start from an empty database, with registration
// open again.
describe('test setup isolation', () => {
  it('leaves state behind on purpose', async () => {
    await authedAgent()
    const { default: User } = await import('../src/resources/user/user.model.js')
    expect(await User.countDocuments()).toBe(1)
    // A collection no Mongoose model has registered in this process
    await mongoose.connection.db.collection('setup_probe').insertOne({ marker: true })
    expect(await mongoose.connection.db.collection('setup_probe').countDocuments()).toBe(1)
  })

  it('starts from an empty database anyway', async () => {
    const { default: User } = await import('../src/resources/user/user.model.js')
    const { default: Setting } = await import('../src/resources/user/setting.model.js')
    expect(await User.countDocuments()).toBe(0)
    expect(await Setting.exists({ _id: 'registrationClosed', value: true })).toBeNull()
    expect(await mongoose.connection.db.collection('setup_probe').countDocuments()).toBe(0)
    // And signing in for the next test works
    const agent = await authedAgent()
    await agent.get('/api/user/me').expect(200)
  })
})
