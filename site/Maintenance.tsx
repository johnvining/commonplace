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

// One-off data fixes to run after deploying an update (listed in
// SCRIPTS_TO_RUN.md). Each task has a dry run that changes nothing; a
// real run asks for confirmation first.
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
                  #{task.issue} ·{' '}
                  {task.lastRun
                    ? `${task.lastRun.ok ? 'Ran' : 'Failed'} ${new Date(task.lastRun.finishedAt).toLocaleString()}`
                    : 'Not run yet'}
                  {task.pending ? null : ' · done'}
                </div>
              </div>
              <TopLevelStandardButtonContainer>
                {confirming === task.id ? (
                  <>
                    <TopLevelStandardButton
                      name="Confirm run"
                      position="left"
                      onClick={() => start(task.id, false)}
                    />
                    <TopLevelStandardButton
                      name="Cancel"
                      position="right"
                      onClick={() => setConfirming(null)}
                    />
                  </>
                ) : (
                  <>
                    <TopLevelStandardButton
                      name="Dry run"
                      position="left"
                      onClick={() => !running && start(task.id, true)}
                    />
                    <TopLevelStandardButton
                      name="Run"
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
                {running ? ' (running…)' : job.status === 'failed' ? ' (failed)' : ' (finished)'}
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
