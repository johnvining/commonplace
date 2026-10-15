import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createIdea, createNote, createPile, createWork } from './setup.js'
import { importCsvFromString } from '../src/cli/import.js'
import Idea from '../src/resources/idea/idea.model.js'
import Pile from '../src/resources/pile/pile.model.js'

const BLANK_NAMES = ['', '   ', undefined]

const entities = [
  { type: 'auth', create: createAuthor },
  { type: 'work', create: (agent, name) => createWork(agent, { name }) },
  { type: 'idea', create: createIdea },
  { type: 'pile', create: createPile },
]

describe('required names', () => {
  for (const { type, create } of entities) {
    describe(type, () => {
      it('rejects a blank name on create', async () => {
        const agent = await authedAgent()
        for (const name of BLANK_NAMES) {
          await agent.post(`/api/${type}/`).send({ name }).expect(400)
        }
      })

      it('trims surrounding whitespace', async () => {
        const agent = await authedAgent()
        const doc = await create(agent, '  Padded  ')
        expect(doc.name).toBe('Padded')
      })

      it('rejects renaming to a blank name and keeps the old one', async () => {
        const agent = await authedAgent()
        const doc = await create(agent, 'Keeper')
        for (const name of ['', '   ']) {
          await agent.put(`/api/${type}/${doc._id}`).send({ name }).expect(400)
        }
        const after = await agent.get(`/api/${type}/${doc._id}`).expect(200)
        expect(after.body.data.name).toBe('Keeper')
      })
    })
  }

  it('rejects blank names when creating from a note or work', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N' })
    const work = await createWork(agent, { name: 'W' })
    await agent.put(`/api/note/${note._id}/idea/create`).send({ name: ' ' }).expect(400)
    await agent.put(`/api/note/${note._id}/pile/create`).send({ name: '' }).expect(400)
    await agent.put(`/api/note/${note._id}/work/create`).send({ newWork: '' }).expect(400)
    await agent.put(`/api/work/${work._id}/auth/create`).send({ name: ' ' }).expect(400)
    await agent.put(`/api/work/${work._id}/pile/create`).send({ name: '' }).expect(400)
  })

  it('skips blank idea and pile names in imports instead of creating them', async () => {
    await authedAgent()
    // Columns: author, title, text, work, url, ideas, images, piles
    await importCsvFromString('A,T,text,W,,"real idea, ,",,"real pile, "', 1)
    const ideas = await Idea.find({}).lean()
    const piles = await Pile.find({}).lean()
    expect(ideas.map(i => i.name)).toEqual(['real idea'])
    expect(piles.map(p => p.name)).toEqual(['real pile'])
  })
})
