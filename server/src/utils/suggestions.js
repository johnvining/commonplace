const { Configuration, OpenAIApi } = require('openai')
import config from '../config'

const configuration = new Configuration({
  apiKey: config.secrets.openaikey
})
const openai = new OpenAIApi(configuration)

export const getSuggestedTitle = async function(note_text) {
  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: 'Return a terse summary of the following text: ' + note_text,
    temperature: 0,
    max_tokens: 100
  })
  return completion.data.choices[0].text
}
