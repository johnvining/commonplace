import Note from '../note/note.model'
import { Auth } from '../auth/auth.model'
import Idea from '../idea/idea.model'
import Work from '../work/work.model'
import Pile from '../pile/pile.model'
import type { Request, Response } from 'express'
import type { Types } from 'mongoose'

export const getStats = async (_req: Request, res: Response) => {
  try {
    const [noteCount, authorCount, ideaCount, workCount, pileCount] = await Promise.all([
      Note.countDocuments(),
      Auth.countDocuments(),
      Idea.countDocuments(),
      Work.countDocuments(),
      Pile.countDocuments(),
    ])

    res.json({
      success: true,
      data: {
        notes: noteCount,
        authors: authorCount,
        ideas: ideaCount,
        works: workCount,
        piles: pileCount,
      },
    })
  } catch (error) {
    console.error('Error getting stats:', error)
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics',
    })
  }
}

const RECENT_LIMIT = 50

// Build a Map<idString, count> from a `$group` aggregate result.
function buildCountMap(
  agg: Array<{ _id: Types.ObjectId | string | null; count: number }>
): Record<string, number> {
  return Object.fromEntries(agg.map((x) => [String(x._id), x.count]))
}

async function recentNotes() {
  return Note.find({})
    .sort({ createdAt: -1 })
    .limit(RECENT_LIMIT)
    .select('-embedding -ocrText -embeddingHash')
    .populate('authors')
    .populate('ideas')
    .populate('piles')
    .populate({ path: 'work', populate: { path: 'authors' } })
    .lean()
    .exec()
}

async function recentAuthors() {
  const items = await Auth.find({}).sort({ createdAt: -1 }).limit(RECENT_LIMIT).lean().exec()
  const ids = items.map((i) => i._id)
  // authors is an array field — same unwind pattern as ideas/piles below.
  const [noteCounts, workCounts] = await Promise.all([
    Note.aggregate([
      { $match: { authors: { $in: ids } } },
      { $unwind: '$authors' },
      { $match: { authors: { $in: ids } } },
      { $group: { _id: '$authors', count: { $sum: 1 } } },
    ]),
    Work.aggregate([
      { $match: { authors: { $in: ids } } },
      { $unwind: '$authors' },
      { $match: { authors: { $in: ids } } },
      { $group: { _id: '$authors', count: { $sum: 1 } } },
    ]),
  ])
  const noteMap = buildCountMap(noteCounts)
  const workMap = buildCountMap(workCounts)
  return items.map((a) => ({
    ...a,
    note_count: noteMap[String(a._id)] || 0,
    work_count: workMap[String(a._id)] || 0,
  }))
}

async function recentWorks() {
  const items = await Work.find({})
    .sort({ createdAt: -1 })
    .limit(RECENT_LIMIT)
    .populate('authors')
    .populate('piles')
    .lean()
    .exec()
  const ids = items.map((i) => i._id)
  const noteCounts = await Note.aggregate([
    { $match: { work: { $in: ids } } },
    { $group: { _id: '$work', count: { $sum: 1 } } },
  ])
  const noteMap = buildCountMap(noteCounts)
  return items.map((w) => ({
    ...w,
    note_count: noteMap[String(w._id)] || 0,
  }))
}

async function recentIdeas() {
  const items = await Idea.find({}).sort({ updatedAt: -1 }).limit(RECENT_LIMIT).lean().exec()
  const ids = items.map((i) => i._id)
  // ideas is an array field — need to unwind for accurate per-idea counts
  const ideaNoteCounts = await Note.aggregate([
    { $match: { ideas: { $in: ids } } },
    { $unwind: '$ideas' },
    { $match: { ideas: { $in: ids } } },
    { $group: { _id: '$ideas', count: { $sum: 1 } } },
  ])
  const noteMap = buildCountMap(ideaNoteCounts)
  return items.map((i) => ({
    ...i,
    note_count: noteMap[String(i._id)] || 0,
  }))
}

async function recentPiles() {
  const items = await Pile.find({}).sort({ updatedAt: -1 }).limit(RECENT_LIMIT).lean().exec()
  const ids = items.map((i) => i._id)
  const [noteAgg, workAgg] = await Promise.all([
    Note.aggregate([
      { $match: { piles: { $in: ids } } },
      { $unwind: '$piles' },
      { $match: { piles: { $in: ids } } },
      { $group: { _id: '$piles', count: { $sum: 1 } } },
    ]),
    Work.aggregate([
      { $match: { piles: { $in: ids } } },
      { $unwind: '$piles' },
      { $match: { piles: { $in: ids } } },
      { $group: { _id: '$piles', count: { $sum: 1 } } },
    ]),
  ])
  const noteMap = buildCountMap(noteAgg)
  const workMap = buildCountMap(workAgg)
  return items.map((p) => ({
    ...p,
    note_count: noteMap[String(p._id)] || 0,
    work_count: workMap[String(p._id)] || 0,
  }))
}

export const getRecentItems = async (req: Request, res: Response) => {
  try {
    const { type } = req.params

    let items: unknown[]
    switch (type) {
      case 'notes': items = await recentNotes(); break
      case 'authors': items = await recentAuthors(); break
      case 'works': items = await recentWorks(); break
      case 'ideas': items = await recentIdeas(); break
      case 'piles': items = await recentPiles(); break
      default:
        return res.status(400).json({ success: false, message: 'Invalid type' })
    }

    res.json({ success: true, data: items })
  } catch (error) {
    console.error('Error getting recent items:', error)
    res.status(500).json({ success: false, message: 'Error retrieving recent items' })
  }
}
