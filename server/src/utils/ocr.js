// import Tesseract from 'tesseract.js'
const Tesseract = require('tesseract.js')

export const ocr = async function(url) {
  // todo: language support
  try {
    const result = await Tesseract.recognize(url, 'eng')

    return result.data.text
  } catch (e) {
    console.log('error')
    console.log(e)
  }

  return null
}
