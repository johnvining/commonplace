import { runOcrBacklog } from '../utils/ocrBacklog'
import { runCli } from './run'

// Fill in the text of image notes that have none (#305). Same as the
// "ocr-backlog" maintenance task, plus --limit:
//   npm run ocr-backlog -- --dry-run      # count, no OpenAI calls
//   npm run ocr-backlog -- --limit 20     # newest 20 first
//   npm run ocr-backlog
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 0
if (limitArg >= 0 && !(limit > 0)) {
  console.error('Usage: npm run ocr-backlog -- [--dry-run] [--limit N]')
  process.exit(1)
}

runCli(async () => {
  const { failed } = await runOcrBacklog({ dryRun, limit, log: console.log })
  if (failed) process.exitCode = 1
})
