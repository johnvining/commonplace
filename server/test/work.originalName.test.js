import { describe, expect, it } from 'vitest'
import { authedAgent, createWork } from './setup.js'

describe('original name on works', () => {
  it('saves the original title and finds the work by either name', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Meditations' })
    await createWork(agent, { name: 'Unrelated' })
    await agent.put(`/api/work/${work._id}`).send({ original_name: ' Τὰ εἰς ἑαυτόν ' }).expect(200)

    const saved = (await agent.get(`/api/work/${work._id}`).expect(200)).body.data
    expect(saved.name).toBe('Meditations')
    expect(saved.original_name).toBe('Τὰ εἰς ἑαυτόν')

    for (const query of ['medit', 'ἑαυτ']) {
      for (const route of ['autocomplete', 'autocomplete/with-counts']) {
        const res = await agent.post(`/api/work/${route}`).send({ string: query }).expect(200)
        expect(res.body.data.map((w) => w.name), `${route} "${query}"`).toEqual(['Meditations'])
      }
    }
  })
})
