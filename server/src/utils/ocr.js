const Tesseract = require('tesseract.js')

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

    return text
  } catch (e) {
    console.log('error')
    console.log(e)
  }

  return null
}
