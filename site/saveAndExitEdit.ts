// Wraps a save call so edit mode only closes on success. On failure we stay
// in edit mode for retry — the global axios error interceptor already shows
// a toast with the server message, so the catch is intentionally quiet here.
// A dev-only console.error is the safety net for the case where the
// interceptor isn't installed or has been bypassed; in prod the user-facing
// toast is the source of truth.
export async function saveAndExitEdit(
  save: () => Promise<unknown>,
  setEdit: (editing: boolean) => void
): Promise<void> {
  try {
    await save()
    setEdit(false)
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error(e)
  }
}
