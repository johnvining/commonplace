import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createIdea, createNote, createPile, createWork } from './setup.js'

describe('work lists include piles and note counts', () => {
  it('on author, pile and idea pages', async () => {
    const agent = await authedAgent()
    const author = await createAuthor(agent, 'Seneca')
    const pile = await createPile(agent, 'Reading: Now')
    const idea = await createIdea(agent, 'Stoicism')
    const work = await createWork(agent, { name: 'Letters', authors: [author._id] })
    const empty = await createWork(agent, { name: 'Essays', authors: [author._id] })
    for (const w of [work, empty]) {
      await agent.put(`/api/work/${w._id}`).send({ piles: [pile._id], ideas: [idea._id] }).expect(200)
    }
    for (let i = 0; i < 3; i++) {
      const n = await createNote(agent, { title: `n${i}` })
      await agent.put(`/api/note/${n._id}`).send({ work: work._id }).expect(200)
    }
    for (const url of [`/api/auth/${author._id}/works`, `/api/pile/${pile._id}/works`, `/api/idea/${idea._id}/works`]) {
      const rows = (await agent.get(url).expect(200)).body.data
      const byName = Object.fromEntries(rows.map((w) => [w.name, w]))
      expect(byName.Letters.note_count, url).toBe(3)
      expect(byName.Essays.note_count, url).toBe(0)
      expect(byName.Letters.piles.map((p) => p.name), url).toEqual(['Reading: Now'])
    }
  })
})
