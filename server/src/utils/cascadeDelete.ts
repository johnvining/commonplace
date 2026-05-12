// Helpers for cascading deletes. Single-node Mongo can't give us real
// transactions, so we settle for: run the cleanup steps with allSettled,
// throw a clear error if anything failed, and only let the parent delete
// run when everything succeeded. The cleanup ops are all idempotent so
// re-running a failed delete recovers the orphan.
export async function runCascadeSteps(
  label: string,
  steps: Array<() => Promise<unknown>>
) {
  const results = await Promise.allSettled(steps.map((s) => s()))
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
  if (failed.length) {
    const sample = failed[0].reason
    throw new Error(
      `[${label}] ${failed.length}/${results.length} cleanup step(s) failed; first error: ${
        sample instanceof Error ? sample.message : String(sample)
      }`
    )
  }
}
