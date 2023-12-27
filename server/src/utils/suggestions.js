import config from '../config'
import fs from 'fs'

import OpenAI from 'openai'
const openai = new OpenAI({
  apiKey: config.secrets.openaikey,
})

export const getSuggestedTitle = async function (note_text) {
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content:
          'Return a terse summary (maximum 15 words) of the following text: ' +
          note_text,
      },
    ],
    model: 'gpt-3.5-turbo',
  })

  return chatCompletion.choices[0].message.content
}

export const getSuggestedIdeas = async function (note_title, note_text) {
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
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
  })

  let suggested_tags = chatCompletion.choices[0].message.content
  try {
    let tags_json = JSON.parse(suggested_tags)
    return tags_json.tags
  } catch (e) {
    return ['Not Valid JSON']
  }
}

// https://platform.openai.com/docs/guides/vision?lang=node
export const getOpenAiOCR = async function (image_location) {
  var imageAsBase64 = fs.readFileSync(image_location, 'base64')
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Transcribe the text in this image and only include semantically important line breaks:',
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
    model: 'gpt-4-vision-preview',
    max_tokens: 1200,
  })

  return chatCompletion.choices[0].message.content
}
