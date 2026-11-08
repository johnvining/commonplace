import { Link } from 'react-router-dom'
import * as db from './Database'

// What a page shows for a record that doesn't exist (#384-#388): deleted,
// or never was. With the name a deleted record's nick kept, it says which.
export default function Missing({ type, name }: { type: string; name?: string | null }) {
  const label = type.charAt(0).toUpperCase() + type.slice(1)
  return (
    <div className="missing-record">
      <h2>{name ? `${label} “${name}” was deleted` : `${label} does not exist`}</h2>
      <p>
        {name ? 'It is no longer here.' : 'It may have been deleted.'} <Link to="/">Go home</Link>
      </p>
    </div>
  )
}

// Whether a request failed because the record doesn't exist
export const isNotFound = (error: any) => error?.response?.status === 404

// What became of a record that doesn't exist, from the nick it had: the
// record it was merged into, or the name it had when deleted. Empty when
// nothing is known.
export async function whatBecameOf(type: string, id: string): Promise<{ forwardTo?: string; name?: string | null }> {
  try {
    const data = (await db.getFormer(type, id))?.data?.data
    if (!data) return {}
    if (data.state === 'alias' && data[type]) return { forwardTo: String(data[type]) }
    return { name: data.name ?? null }
  } catch {
    return {}
  }
}
