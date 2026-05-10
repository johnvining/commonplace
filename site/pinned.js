const STORAGE_KEY = 'pinned-items-v1'

const readStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) {
      return { items: [] }
    }
    return parsed
  } catch (error) {
    console.error('Pinned storage parse error:', error)
    return { items: [] }
  }
}

const writeStorage = (items) => {
  const payload = { items }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export const getPinnedItems = () => {
  return readStorage().items
}

export const isPinned = (type, id) => {
  return getPinnedItems().some((item) => item.type === type && item.id === id)
}

const pinItem = ({ type, id, label, href }) => {
  if (!type || !id) return
  const items = getPinnedItems()
  const next = [
    { type, id, label, href, pinnedAt: Date.now() },
    ...items.filter((item) => !(item.type === type && item.id === id)),
  ]
  writeStorage(next)
  window.dispatchEvent(new Event('pinned-items-updated'))
}

export const unpinItem = (type, id) => {
  const items = getPinnedItems()
  const next = items.filter((item) => !(item.type === type && item.id === id))
  writeStorage(next)
  window.dispatchEvent(new Event('pinned-items-updated'))
}

export const togglePinned = ({ type, id, label, href }) => {
  if (isPinned(type, id)) {
    unpinItem(type, id)
  } else {
    pinItem({ type, id, label, href })
  }
}
