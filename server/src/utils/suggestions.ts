import config from '../config'
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

  return chatCompletion.choices[0].message.content
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
            text: 'Transcribe the text in this image and only include semantically important line breaks. Return just the text without any additional punctuation or markdown.',
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

  return chatCompletion.choices[0].message.content
}
