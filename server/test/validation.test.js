import { describe, expect, it } from 'vitest'
import { authedAgent } from './setup.js'
import { importCsvFromString } from '../src/cli/import.js'
import Idea from '../src/resources/idea/idea.model.js'
import Pile from '../src/resources/pile/pile.model.js'

describe('required names', () => {
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
