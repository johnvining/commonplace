import { useCallback, useState } from 'react'
import * as db from './Database'
import { saveAndExitEdit } from './saveAndExitEdit'

// Edit state shared by the author, idea, pile and work pages (#233):
// the record's saved values, the values being edited, and edit mode.
//
// `values` are keyed by the API's field names, so by default they are
// sent as-is on save. Cancelling restores the saved values; before, an
// abandoned edit stayed in the form and went out with the next save.
export function useEntityEditor<T extends object>(type: string, id: string, empty: T) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState<T>(empty)
  const [values, setValues] = useState<T>(empty)

  // Call with the record's values once it has loaded.
  const load = useCallback((record: T) => {
    setSaved(record)
    setValues(record)
  }, [])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
  }, [])

  const cancel = useCallback(() => {
    setValues(saved)
    setEditing(false)
  }, [saved])

  // Save and leave edit mode; on failure stay in edit mode (the request
  // error toast explains why). `toUpdate` shapes the request body when
  // it differs from `values`.
  const save = useCallback(
    (toUpdate: (values: T) => object = (v) => v) =>
      saveAndExitEdit(async () => {
        await db.updateRecord(type, id, toUpdate(values))
        setSaved(values)
      }, setEditing),
    [type, id, values]
  )

  return { editing, setEditing, values, set, load, save, cancel }
}
