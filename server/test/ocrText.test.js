import { describe, expect, it } from 'vitest'
import { cleanOcrText } from '../src/utils/ocrText.js'

describe('cleanOcrText', () => {
  it('turns NO_TEXT and apologies into an empty string', () => {
    for (const reply of [
      'NO_TEXT',
      ' NO_TEXT. ',
      "Sorry, I can't transcribe the text from this image.",
      'I cannot transcribe the text from the image you provided. If you have any other questions, let me know.',
      "I'm sorry, I cannot transcribe the text as no visible text is present in the image provided.",
      'There is no visible text in this image.',
      null,
      '',
    ]) {
      expect(cleanOcrText(reply)).toBe('')
    }
  })

  it('keeps real transcriptions, even ones that start like an apology', () => {
    expect(cleanOcrText('  The policy world can be thought of as ropes.  ')).toBe('The policy world can be thought of as ropes.')
    const letter = 'Sorry for the delay in writing. ' + 'The text of the treaty reads as follows. '.repeat(10)
    expect(cleanOcrText(letter)).toBe(letter.trim())
  })
})
