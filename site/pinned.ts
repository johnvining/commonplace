import type { EntityId, EntityType } from '../types/api'

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

const pinItem = ({ type, id, label, href }: PinnedItem): void => {
  if (!type || !id) return
  const items = getPinnedItems()
  const next: PinnedItem[] = [
    { type, id, label, href, pinnedAt: Date.now() },
    ...items.filter((item: any) => !(item.type === type && item.id === id)),
  ]
  writeStorage(next)
  window.dispatchEvent(new Event('pinned-items-updated'))
}

export const unpinItem = (type: EntityType, id: EntityId): void => {
  const items = getPinnedItems()
  const next = items.filter((item: any) => !(item.type === type && item.id === id))
  writeStorage(next)
  window.dispatchEvent(new Event('pinned-items-updated'))
}

export const togglePinned = ({ type, id, label, href }: PinnedItem): void => {
  if (isPinned(type, id)) {
    unpinItem(type, id)
  } else {
    pinItem({ type, id, label, href })
  }
}
