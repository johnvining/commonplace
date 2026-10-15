import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createIdea, createPile, createWork } from './setup.js'

const types = [
  ['auth', createAuthor],
  ['work', (agent, name) => createWork(agent, { name })],
  ['idea', createIdea],
  ['pile', createPile],
]

describe('autocomplete ordering', () => {
  for (const [type, create] of types) {
    for (const route of ['autocomplete', 'autocomplete/with-counts']) {
      it(`${type} ${route}: exact name first, then prefixes, then the rest`, async () => {
        const agent = await authedAgent()
        // Partial matches created before the exact one, so insertion order
        // would bury it.
        for (const name of ['Fall of Rome', 'Rome, sack of', 'Romeo', 'Ancient Rome']) {
          await create(agent, name)
        }
        for (let i = 0; i < 12; i++) await create(agent, `Rome topic ${String(i).padStart(2, '0')}`)
        await create(agent, 'Rome')

        const res = await agent.post(`/api/${type}/${route}`).send({ string: 'rome' }).expect(200)
        const names = res.body.data.map(d => d.name)
        expect(names[0]).toBe('Rome')
        expect(names.slice(1, 15)).toEqual([...Array(12)].map((_, i) => `Rome topic ${String(i).padStart(2, '0')}`).concat(['Rome, sack of', 'Romeo']).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())))
        expect(names.slice(15)).toEqual(['Ancient Rome', 'Fall of Rome'])
      })
    }
  }
})
