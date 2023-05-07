const { Configuration, OpenAIApi } = require('openai')
import config from '../config'

const configuration = new Configuration({
  apiKey: config.secrets.openaikey
})
const openai = new OpenAIApi(configuration)

export const getSuggestedTitle = async function(note_text) {
  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt:
      'Return a terse summary (maximum 15 words) of the following text: ' +
      note_text,
    temperature: 0.3,
    max_tokens: 30
  })
  const suggested_title = completion.data.choices[0].text
  return suggested_title
}

export const getSuggestedIdeas = async function(note_title, note_text) {
  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt:
      "Create a list of 8 tags for the following text, and add a list of 5 possible decades of the form (1950's) this could be about," +
      ' including the comma before "s". Combine those lists and print them without quotes, title-case, separated by commas. Do not print the original' +
      ' lists, just print the combined list. Do not print a period at the end of your answer.\nThe Text: ' +
      note_title +
      '\n' +
      note_text,
    temperature: 0.3,
    max_tokens: 70
  })
  const suggested_tags = completion.data.choices[0].text
    .replaceAll('\n', '')
    .replaceAll('Tags:', '')
    .replaceAll('.', '')
    .split(',')
    .map(function(tag) {
      return tag.trim()
    })
  return suggested_tags
}
