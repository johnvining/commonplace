import type { EntityId, EntityType } from '../types/api'
import * as db from './Database'

// Starred items live on the server so they sync across devices. This
// browser keeps a copy in localStorage, so star icons can be drawn at
// once; syncPinned refreshes it from the server, and starring or
// unstarring updates the copy first, then the server.

const STORAGE_KEY = 'pinned-items-v1'

export interface PinnedItem {
  type: EntityType
  id: EntityId
  label?: string
  href?: string
  pinnedAt?: number
}

interface StoragePayload {
  items: PinnedItem[]
}

const readStorage = (): StoragePayload => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) {
      return { items: [] }
    }
    return parsed
  } catch (error: any) {
    console.error('Pinned storage parse error:', error)
    return { items: [] }
  }
}

const writeStorage = (items: PinnedItem[]): void => {
  const payload: StoragePayload = { items }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export const getPinnedItems = (): PinnedItem[] => {
  return readStorage().items
}

export const isPinned = (type: EntityType, id: EntityId): boolean => {
  return getPinnedItems().some((item: any) => item.type === type && item.id === id)
}

const announce = () => window.dispatchEvent(new Event('pinned-items-updated'))

// Bumped by every local star/unstar, so a sync that started earlier
// doesn't overwrite a change made while it was waiting on the server.
let localVersion = 0

const pinItem = ({ type, id, label, href }: PinnedItem): void => {
  if (!type || !id) return
  const items = getPinnedItems()
  const next: PinnedItem[] = [
    { type, id, label, href, pinnedAt: Date.now() },
    ...items.filter((item: any) => !(item.type === type && item.id === id)),
  ]
  writeStorage(next)
  localVersion++
  announce()
  db.putPin({ type, id: String(id), label, href }).catch(syncPinned)
}

export const unpinItem = (type: EntityType, id: EntityId): void => {
  const items = getPinnedItems()
  const next = items.filter((item: any) => !(item.type === type && item.id === id))
  writeStorage(next)
  localVersion++
  announce()
  db.deletePin(type, String(id)).catch(syncPinned)
}

// Replace this browser's copy with the server's list. The first time, if
// the server has none but this browser does (stars from before they were
// stored on the server), upload them.
export async function syncPinned(): Promise<void> {
  const startedAt = localVersion
  try {
    let items: PinnedItem[] = await db.getPins()
    const local = getPinnedItems()
    if (!items.length && local.length) items = await db.importPins(local)
    // Starred or unstarred something meanwhile: the local copy is newer.
    if (localVersion !== startedAt) return
    writeStorage(items)
    announce()
  } catch (error) {
    // Offline or logged out: keep the local copy.
    console.error('Could not sync starred items', error)
  }
}

export const togglePinned = ({ type, id, label, href }: PinnedItem): void => {
  if (isPinned(type, id)) {
    unpinItem(type, id)
  } else {
    pinItem({ type, id, label, href })
  }
}
