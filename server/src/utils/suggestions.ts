import config from '../config'
import { NO_TEXT, cleanOcrText } from './ocrText.js'
import fs from 'fs'

import OpenAI from 'openai'
// The SDK defaults to a 10-minute timeout and 2 retries. 10 minutes is
// long enough for a stuck call to block a deploy on its own; cap it at
// 60s and let the SDK back off + retry up to 3 times for transient
// rate-limit / 5xx errors.
const openai = new OpenAI({
  apiKey: config.secrets.openaikey,
  timeout: 60_000,
  maxRetries: 3,
})

export const getSuggestedTitle = async function (
  note_text: string
): Promise<string | null> {
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content:
          'Return a terse summary (maximum 15 words) of the following text: ' +
          note_text,
      },
    ],
    model: 'gpt-4o-mini',
  })

  return cleanSuggestedTitle(chatCompletion.choices[0].message.content)
}

// The model tends to end titles with a space or newline and sometimes
// wraps them in quotes; strip both (#322).
export function cleanSuggestedTitle(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const title = raw.trim()
  const wrapped = title.match(/^["“'‘](.*)["”'’]$/s)
  return (wrapped ? wrapped[1] : title).trim()
}

export const getSuggestedIdeas = async function (
  note_title: string,
  note_text: string
): Promise<string[]> {
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'You are a diligent assistant whose job is to categorize text and suggest a list of tags as JSON output.',
      },
      {
        role: 'user',
        content:
          'Create a list of 10 possible tags that could be used to categorize the following text. They may be things like: people mentioned in the text, ' +
          ' topics mentioned in the text, the type of text, or subjects the text is relevant to. Also, include up to three decades that are relevant to the ' +
          " text in the format of 1950's. Format the results as a list of Sentence-case strings " +
          ' except for proper nouns, which should be capitalized in JSON.' +
          ' The Text: ' +
          note_title +
          '\n' +
          note_text,
      },
    ],
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
  })

  const suggested_tags = chatCompletion.choices[0].message.content
  try {
    const tags_json = JSON.parse(suggested_tags ?? '{}')
    return tags_json.tags
  } catch (e) {
    return ['Not Valid JSON']
  }
}

// Photos of book pages usually mark the passages that matter, and often
// carry pencil notes in the margins (#354). Marked passages win over the
// full page; margin notes come last, each on a "Margin:" line.
export const OCR_PROMPT = [
  'Transcribe the text in this image.',
  'If some passages are marked (highlighted, underlined, bracketed, or flagged with a line or mark in the margin), ' +
    'transcribe only the marked passages, in reading order, with a blank line between separate passages. ' +
    'Otherwise transcribe all of the printed text.',
  'Then, if there are handwritten notes (often faint pencil in the margins or between lines), transcribe each one ' +
    'on its own line at the end, starting with "Margin: ". Skip marks that are not words, such as lines, ticks and stars. ' +
    'Write [illegible] for a handwritten word you cannot read.',
  'Only include semantically important line breaks; join lines broken by the page width and rejoin hyphenated words.',
  'Return just the text without any additional punctuation or markdown.',
  `If the image has no text to transcribe (a photo, a painting), reply with exactly ${NO_TEXT}.`,
].join(' ')

export const getOpenAiOCR = async function (
  image_location: string
): Promise<string | null> {
  const imageAsBase64 = fs.readFileSync(image_location, 'base64')
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: OCR_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/jpeg;base64,' + imageAsBase64,
            },
          },
        ],
      },
    ],
    model: 'gpt-4o-mini',
    max_tokens: 1200,
  })

  // '' when the image has no text (see ocrText.ts).
  return cleanOcrText(chatCompletion.choices[0].message.content)
}
