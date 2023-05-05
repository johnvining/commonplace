const { Configuration, OpenAIApi } = require('openai')
import config from '../config'

const configuration = new Configuration({
  apiKey: config.secrets.openaikey
})
const openai = new OpenAIApi(configuration)

export const getSuggestedTitle = async function(title) {
  console.log('suggested title')
  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: 'Return the value ABCDEFGH twice',
    temperature: 0,
    max_tokens: 7
  })
  return completion.data.choices[0].text
}
