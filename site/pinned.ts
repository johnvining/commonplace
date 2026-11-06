import type { EntityId, EntityType } from '../types/api'
import * as db from './Database'

// Starred items live on the server so they sync across devices. This
// browser keeps two things in localStorage (#381):
//
//   the confirmed list  what the server last said is starred
//   the pending queue   stars and unstars made here and not yet confirmed,
//                       each stamped with when it was made
//
// What's shown is the confirmed list with the queue applied on top, so a
// change shows at once and is marked pending until the server confirms
// it. A change leaves the queue only once the server has it; a failed
// sync keeps it queued, so an unstar made offline survives, and a failed
// star can't flip back. The server settles conflicts between devices by
// the latest change.

const STORAGE_KEY = 'pinned-items-v1'
const QUEUE_KEY = 'pinned-queue-v1'
// Set once this browser's pre-server stars have been queued for upload
const IMPORTED_KEY = 'pinned-items-imported'

export interface PinnedItem {
  type: EntityType
  id: EntityId
  label?: string
  href?: string
  pinnedAt?: number
  // Starred here and not yet confirmed by the server
  pending?: boolean
}

export interface PinChange {
  op: 'pin' | 'unpin'
  type: EntityType
  id: EntityId
  label?: string
  href?: string
  at: number
}

function readList<T>(key: string, field: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed && Array.isArray(parsed[field]) ? parsed[field] : []
  } catch (error: any) {
    console.error('Pinned storage parse error:', error)
    return []
  }
}

function writeList(key: string, field: string, list: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ [field]: list }))
  } catch {}
}

const readConfirmed = () => readList<PinnedItem>(STORAGE_KEY, 'items')
const readQueue = () => readList<PinChange>(QUEUE_KEY, 'changes')
const sameItem = (a: { type: string; id: unknown }, b: { type: string; id: unknown }) =>
  a.type === b.type && String(a.id) === String(b.id)

// The confirmed list with pending changes applied, newest change on top
export function applyQueue(confirmed: PinnedItem[], queue: PinChange[]): PinnedItem[] {
  let items: PinnedItem[] = confirmed.map(({ pending: _, ...item }) => item)
  for (const change of queue) {
    items = items.filter((item) => !sameItem(item, change))
    if (change.op === 'pin') {
      const { type, id, label, href, at } = change
      items.unshift({ type, id, label, href, pinnedAt: at, pending: true })
    }
  }
  return items
}

export const getPinnedItems = (): PinnedItem[] => applyQueue(readConfirmed(), readQueue())

export const isPinned = (type: EntityType, id: EntityId): boolean =>
  getPinnedItems().some((item) => sameItem(item, { type, id }))

const announce = () => window.dispatchEvent(new Event('pinned-items-updated'))

// Queue a change, replacing any earlier one for the same item, show it,
// and send it
function queueChange(change: PinChange) {
  writeList(QUEUE_KEY, 'changes', [...readQueue().filter((c) => !sameItem(c, change)), change])
  announce()
  syncPinned()
}

const pinItem = ({ type, id, label, href }: PinnedItem): void => {
  if (!type || !id) return
  queueChange({ op: 'pin', type, id, label, href, at: Date.now() })
}

export const unpinItem = (type: EntityType, id: EntityId): void => {
  queueChange({ op: 'unpin', type, id, at: Date.now() })
}

export const togglePinned = ({ type, id, label, href }: PinnedItem): void => {
  if (isPinned(type, id)) unpinItem(type, id)
  else pinItem({ type, id, label, href })
}

// Stars kept in this browser from before they lived on the server go up
// once, as changes stamped with when they were starred, so the server
// keeps whichever is newer
function queueLegacyStars() {
  try {
    if (localStorage.getItem(IMPORTED_KEY) === '1') return
    const queued = readQueue()
    const legacy = readConfirmed()
      .filter((item) => !queued.some((c) => sameItem(c, item)))
      .map((item): PinChange => ({ op: 'pin', type: item.type, id: item.id, label: item.label, href: item.href, at: item.pinnedAt ?? Date.now() }))
    if (legacy.length) writeList(QUEUE_KEY, 'changes', [...legacy, ...queued])
    localStorage.setItem(IMPORTED_KEY, '1')
  } catch {}
}

// Send the pending changes and take the server's list as confirmed. One
// sync at a time; a change made during it is sent by the next one.
let syncing: Promise<void> | null = null
let syncAgain = false

export function syncPinned(): Promise<void> {
  if (syncing) {
    syncAgain = true
    return syncing
  }
  syncing = (async () => {
    queueLegacyStars()
    const sent = readQueue()
    try {
      const confirmed: PinnedItem[] = await db.syncPins(sent)
      // Drop exactly what was sent; anything queued meanwhile stays
      const stillPending = readQueue().filter((c) => !sent.some((s) => sameItem(s, c) && s.at === c.at))
      writeList(QUEUE_KEY, 'changes', stillPending)
      writeList(STORAGE_KEY, 'items', confirmed)
      announce()
    } catch (error) {
      // Offline or logged out: everything stays pending, to send next time
      console.error('Could not sync starred items', error)
    }
  })().finally(() => {
    syncing = null
    if (syncAgain) {
      syncAgain = false
      syncPinned()
    }
  })
  return syncing
}
