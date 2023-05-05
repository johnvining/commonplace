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
    .replace('\n\n', '')
    .replace('\n', '')
    .replace('.', '')
}
