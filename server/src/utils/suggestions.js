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
      "Create a list of 10 tags for the following text, and add an additional list of 3 possible decades of the form (1950's) that the text is describing, " +
      'including the comma before "s". Combine those lists and print them with the following formatting rules: 1) there should not be any quote ' +
      'characters, 2) the tags should be separated by commas. For each tag, make every word lowercase except proper nouns. Do not print the original ' +
      'lists, just print the combined list. Do not print a period at the end of your answer.\nThe Text: ' +
      note_title +
      '\n' +
      note_text,
    temperature: 0.3,
    max_tokens: 75
  })
  let suggested_tags = completion.data.choices[0].text
  console.log(suggested_tags)
  return suggested_tags
    .replaceAll('\n', '')
    .replaceAll('Tags:', '')
    .replaceAll('.', '')
    .split(',')
    .map(function(tag) {
      let trimmed = tag.trim()
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    })
}
