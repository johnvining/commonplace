import { importCSV } from './import'
import { runCli } from './run'

// npm run import -- <file.csv> <type>
//   type 1: notes, 2: works, 3: Instapaper highlights
const [filePath, type] = process.argv.slice(2)
if (!filePath || !['1', '2', '3'].includes(type)) {
  console.error('Usage: npm run import -- <file.csv> <type>')
  console.error('  type 1: notes, 2: works, 3: Instapaper highlights')
  process.exit(1)
}

runCli(() => importCSV(filePath, Number(type)))
