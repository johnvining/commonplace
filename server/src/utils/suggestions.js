import config from '../config'

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

// TODO: Look in to JSON return type
export const getSuggestedIdeas = async function (note_title, note_text) {
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content:
          "Create a list of 10 tags for the following text, and add an additional list of 3 possible decades of the form (1950's) that the text is describing, " +
          'including the comma before "s". Combine those lists and print them with the following formatting rules: 1) there should not be any quote ' +
          'characters, 2) the tags should be separated by commas. For each tag, make every word lowercase except proper nouns. Do not print the original ' +
          'lists, just print the combined list. Do not print a period at the end of your answer.\nThe Text: ' +
          note_title +
          '\n' +
          note_text,
      },
    ],
    model: 'gpt-3.5-turbo',
  })

  let suggested_tags = chatCompletion.choices[0].message.content

  // Server doesn't support .replaceAll apparently
  return suggested_tags
    .replace('\n', '')
    .replace('Tags:', '')
    .replace('.', '')
    .split(',')
    .map(function (tag) {
      let trimmed = tag.trim()
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    })
}

export const getLLMCorrectedText = async function (text) {
  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt:
      'The following text is the output of an OCR program. Please correct any errors: ' +
      text,
    temperature: 0.2,
    max_tokens: 200,
  })

  return completion.data.choices[0].text
}
