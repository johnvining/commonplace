import { describe, it, expect, vi, beforeEach } from 'vitest'

// The server, as far as pinned.ts can tell: a sync that can be made to fail
let serverList: any[] = []
let fail = false
const sent: any[][] = []
vi.mock('../Database', () => ({
  syncPins: vi.fn(async (changes: any[]) => {
    sent.push(changes)
    if (fail) throw new Error('offline')
    for (const c of changes) {
      serverList = serverList.filter((p) => !(p.type === c.type && p.id === c.id))
      if (c.op === 'pin') serverList.unshift({ type: c.type, id: c.id, label: c.label, pinnedAt: c.at })
    }
    return serverList
  }),
}))

// An in-memory localStorage: Node's own experimental one shadows jsdom's
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
})

const load = async () => {
  vi.resetModules()
  return import('../pinned')
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('pinned-items-imported', '1')
  serverList = []
  fail = false
  sent.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('starred items sync (#381)', () => {
  it('shows a star at once as pending, then confirmed after the sync', async () => {
    const pinned = await load()
    pinned.togglePinned({ type: 'work', id: 'w1', label: 'W' })
    expect(pinned.getPinnedItems()).toEqual([expect.objectContaining({ id: 'w1', pending: true })])
    await pinned.syncPinned()
    expect(pinned.getPinnedItems()).toEqual([expect.objectContaining({ id: 'w1', label: 'W' })])
    expect(pinned.getPinnedItems()[0].pending).toBeUndefined()
  })

  it('keeps an offline unstar queued and sends it later, instead of losing it', async () => {
    serverList = [{ type: 'idea', id: 'i1', label: 'I' }]
    localStorage.setItem('pinned-items-v1', JSON.stringify({ items: serverList }))
    const pinned = await load()
    fail = true
    pinned.unpinItem('idea', 'i1')
    await pinned.syncPinned()
    // Still unstarred here, though the server didn't get it
    expect(pinned.isPinned('idea', 'i1')).toBe(false)
    fail = false
    await pinned.syncPinned()
    expect(sent.at(-1)).toEqual([expect.objectContaining({ op: 'unpin', id: 'i1' })])
    expect(serverList).toEqual([])
    expect(pinned.isPinned('idea', 'i1')).toBe(false)
  })

  it('never lets a failed star flip back on its own', async () => {
    const pinned = await load()
    fail = true
    pinned.togglePinned({ type: 'pile', id: 'p1', label: 'P' })
    await pinned.syncPinned()
    expect(pinned.isPinned('pile', 'p1')).toBe(true)
  })

  it('uploads stars from before the server held them, once', async () => {
    localStorage.removeItem('pinned-items-imported')
    localStorage.setItem('pinned-items-v1', JSON.stringify({ items: [{ type: 'note', id: 'n1', label: 'Old', pinnedAt: 5 }] }))
    const pinned = await load()
    await pinned.syncPinned()
    expect(sent[0]).toEqual([expect.objectContaining({ op: 'pin', id: 'n1', at: 5 })])
    await pinned.syncPinned()
    expect(sent[1]).toEqual([])
  })

  it('applies queued changes over the confirmed list, newest on top', async () => {
    const { applyQueue } = await load()
    const items = applyQueue(
      [{ type: 'work', id: 'a' } as any, { type: 'work', id: 'b' } as any],
      [{ op: 'unpin', type: 'work', id: 'a', at: 1 }, { op: 'pin', type: 'idea', id: 'c', at: 2 }]
    )
    expect(items.map((i) => i.id)).toEqual(['c', 'b'])
  })
})
