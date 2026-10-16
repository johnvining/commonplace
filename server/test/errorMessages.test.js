import { describe, expect, it } from 'vitest'
import { authedAgent, createNote } from './setup.js'

const MISSING = '507f1f77bcf86cd799439011'

describe('error responses say why', () => {
  it('names what was not found', async () => {
    const agent = await authedAgent()
    for (const [url, message] of [
      [`/api/work/${MISSING}`, 'Work not found'],
      [`/api/idea/${MISSING}`, 'idea not found'],
      [`/api/pile/${MISSING}`, 'pile not found'],
      [`/api/auth/${MISSING}`, 'author not found'],
    ]) {
      const res = await agent.get(url).expect(400)
      expect(res.body.message, url).toBe(message)
    }
    const res = await agent.get(`/api/note/${MISSING}/images/1`).expect(404)
    expect(res.body.message).toBe('Note not found')
  })

  it('explains refused requests', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'X' })
    const img = await agent.delete(`/api/note/${note._id}/image/`).send({ filename: 'nope.jpg' }).expect(400)
    expect(img.body.message).toBe('That image is not on this note')
    const pile = await agent.post('/api/pile/').send({ name: '  ' }).expect(400)
    expect(pile.body.message).toBe('Give the pile a name')
  })
})
