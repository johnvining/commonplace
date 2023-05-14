const Tesseract = require('tesseract.js')
import { getLLMCorrectedText } from './suggestions.js'

export const ocr = async function(url) {
  // todo: language support
  try {
    const worker = await Tesseract.createWorker({
      logger: m => console.log(m)
    })

    await worker.loadLanguage('eng')
    await worker.initialize('eng')
    const {
      data: { text }
    } = await worker.recognize(url)
    await worker.terminate()
    let corrected_text = await getLLMCorrectedText(text)

    return corrected_text
  } catch (e) {
    console.log('error')
    console.log(e)
  }

  return null
}
