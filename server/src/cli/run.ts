import mongoose from 'mongoose'
import { connect } from '../utils/db'

// Run a command-line job against the database. Always disconnects
// afterwards, even if the job throws, so the process exits when the job
// is done instead of hanging on the open Mongo connection (#223).
export async function runCli(job: () => Promise<unknown>) {
  try {
    await connect()
    await job()
  } catch (e) {
    console.error(e)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}
