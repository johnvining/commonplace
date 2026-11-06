import { useCallback, useEffect, useRef, useState } from 'react'
import * as db from './Database'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import {
  TopLevelTitleContainer,
  TopLevelTitle,
  TopLevelSubTitle,
} from './TopLevelHeadings'
import { useKeyboardShortcuts } from './KeyboardContext'
import * as constants from './constants'

// One-off data fixes to run after deploying an update (listed in
// SCRIPTS_TO_RUN.md). Each task has a dry run that changes nothing; a
// real run asks for confirmation first.
// A task's last real run (#376): it may still be going, or have been cut
// off by a restart, as well as finished or failed
function lastRunLabel(run: { status?: string; ok?: boolean; startedAt?: string; finishedAt?: string | null }) {
  const at = (when?: string | null) => (when ? ' ' + new Date(when).toLocaleString() : '')
  switch (run.status ?? (run.ok ? 'done' : 'failed')) {
    case 'running': return 'Running since' + at(run.startedAt)
    case 'interrupted': return 'Interrupted' + at(run.startedAt) + ' (the server stopped mid-run)'
    case 'done': return 'Ran' + at(run.finishedAt)
    default: return 'Failed' + at(run.finishedAt)
  }
}

function Maintenance(props: any) {
  const [tasks, setTasks] = useState<any[] | null>(null)
  const [jobs, setJobs] = useState<Record<string, any>>({})
  const [confirming, setConfirming] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const loadTasks = useCallback(() => {
    db.getMaintenanceTasks()
      .then((res: any) => setTasks(res.data.data))
      .catch((err: any) => console.error(err))
  }, [])

  useEffect(() => {
    loadTasks()
    const pending = timers.current
    return () => Object.values(pending).forEach(clearTimeout)
  }, [loadTasks])

  const poll = (taskId: string, jobId: string) => {
    db.getMaintenanceJob(jobId)
      .then((res: any) => {
        const job = res.data.data
        setJobs((j) => ({ ...j, [taskId]: job }))
        if (job.status === 'running') {
          timers.current[taskId] = setTimeout(() => poll(taskId, jobId), 1000)
        } else {
          loadTasks()
        }
      })
      .catch((err: any) => {
        const message = err?.response?.data?.message ?? 'Lost track of the job'
        setJobs((j) => ({ ...j, [taskId]: { status: 'failed', output: [message] } }))
      })
  }

  const start = async (taskId: string, dryRun: boolean) => {
    setConfirming(null)
    setJobs((j) => ({ ...j, [taskId]: { status: 'running', dryRun, output: [] } }))
    try {
      const res = await db.startMaintenanceTask(taskId, dryRun)
      poll(taskId, res.data.data.jobId)
    } catch (err: any) {
      const message = err?.response?.data?.message ?? 'Could not start the task'
      setJobs((j) => ({ ...j, [taskId]: { status: 'failed', output: [message] } }))
    }
  }

  props.setPageTitle('Maintenance')

  const pendingCount = tasks?.filter((t) => t.pending).length ?? 0
  // Tasks run in order, so the keys act on the next one to run:
  // Shift+D dry run, Shift+R run (then Enter confirms, Esc cancels).
  const nextTask = tasks?.find((t) => t.pending) ?? null
  useKeyboardShortcuts(constants.keyboardScopes.ENTITY_PAGE, (event: any) => {
    if (confirming) {
      if (event.keyCode === constants.keyCodes.enter) {
        start(confirming, false)
        return true
      }
      if (event.keyCode === constants.keyCodes.esc) {
        setConfirming(null)
        return true
      }
      return false
    }
    if (!nextTask || jobs[nextTask.id]?.status === 'running' || !event.shiftKey || event.ctrlKey) return false
    if (event.keyCode === constants.keyCodes.theme) {
      start(nextTask.id, true)
      return true
    }
    if (event.keyCode === constants.keyCodes.read) {
      setConfirming(nextTask.id)
      return true
    }
    return false
  })

  return (
    <div>
      <TopLevelTitleContainer>
        <TopLevelTitle>Maintenance</TopLevelTitle>
        <TopLevelSubTitle>
          {tasks === null
            ? 'Loading…'
            : pendingCount
              ? `${pendingCount} of ${tasks.length} tasks still to run, in this order`
              : 'All tasks have been run'}
        </TopLevelSubTitle>
      </TopLevelTitleContainer>

      {tasks?.map((task) => {
        const job = jobs[task.id]
        const running = job?.status === 'running'
        return (
          <div className="maintenance-task" key={task.id}>
            <div className="maintenance-task-header">
              <div>
                <div className="maintenance-task-title">{task.title}</div>
                <div className="maintenance-task-status">
                  {task.issue ? `#${task.issue} · ` : null}
                  {task.lastRun ? lastRunLabel(task.lastRun) : 'Not run yet'}
                  {task.pending ? null : ' · done'}
                </div>
              </div>
              <TopLevelStandardButtonContainer>
                {confirming === task.id ? (
                  <>
                    <TopLevelStandardButton
                      name="Confirm run"
                      shortcut="Enter"
                      position="left"
                      onClick={() => start(task.id, false)}
                    />
                    <TopLevelStandardButton
                      name="Cancel"
                      shortcut="Esc"
                      position="right"
                      onClick={() => setConfirming(null)}
                    />
                  </>
                ) : (
                  <>
                    <TopLevelStandardButton
                      name="Dry run"
                      shortcut={task === nextTask ? 'Shift+D' : undefined}
                      position="left"
                      onClick={() => !running && start(task.id, true)}
                    />
                    <TopLevelStandardButton
                      name="Run"
                      shortcut={task === nextTask ? 'Shift+R' : undefined}
                      position="right"
                      onClick={() => !running && setConfirming(task.id)}
                    />
                  </>
                )}
              </TopLevelStandardButtonContainer>
            </div>
            <div className="maintenance-task-description">{task.description}</div>
            {job ? (
              <pre className="maintenance-output">
                {job.dryRun ? 'Dry run' : 'Run'}
                {running
                  ? ' (running…)'
                  : job.status === 'failed'
                  ? ' (failed)'
                  : job.status === 'interrupted'
                  ? ' (interrupted: the server stopped before it finished)'
                  : ' (finished)'}
                {'\n'}
                {job.output.join('\n')}
              </pre>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default Maintenance
