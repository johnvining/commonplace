import { TASKS } from '../resources/maintenance/tasks'
import { runTask } from '../resources/maintenance/jobs'
import { runCli } from './run'

// Command-line twin of the Maintenance page:
//   npm run maintenance                     # list tasks
//   npm run maintenance -- <id> --dry-run   # show what would change
//   npm run maintenance -- <id>             # run it
const [taskId, ...rest] = process.argv.slice(2)
const dryRun = rest.includes('--dry-run')

if (!taskId) {
  for (const t of TASKS) console.log(`${t.id.padEnd(20)} #${t.issue}  ${t.title}`)
  process.exit(0)
}

runCli(async () => {
  const ok = await runTask(taskId, dryRun)
  if (!ok) process.exitCode = 1
})
