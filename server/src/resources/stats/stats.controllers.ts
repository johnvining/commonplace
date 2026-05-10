import Note from '../note/note.model'
import { Auth } from '../auth/auth.model'
import Idea from '../idea/idea.model'
import Work from '../work/work.model'
import Pile from '../pile/pile.model'

export const getStats = async (req, res) => {
  try {
    const [noteCount, authorCount, ideaCount, workCount, pileCount] = await Promise.all([
      Note.countDocuments(),
      Auth.countDocuments(),
      Idea.countDocuments(),
      Work.countDocuments(),
      Pile.countDocuments()
    ])

    res.json({
      success: true,
      data: {
        notes: noteCount,
        authors: authorCount,
        ideas: ideaCount,
        works: workCount,
        piles: pileCount
      }
    })
  } catch (error) {
    console.error('Error getting stats:', error)
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics'
    })
  }
}

export const getRecentItems = async (req, res) => {
  try {
    const { type } = req.params
    const limit = 50

    let items = []
    switch (type) {
      case 'notes':
        items = await Note.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .select('-embedding -ocrText -embeddingHash')
          .populate('author')
          .populate('ideas')
          .populate('piles')
          .populate({ path: 'work', populate: { path: 'author' } })
          .lean()
          .exec()
        break

      case 'authors': {
        items = await Auth.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec()
        const ids = items.map(i => i._id)
        const [noteCounts, workCounts] = await Promise.all([
          Note.aggregate([
            { $match: { author: { $in: ids } } },
            { $group: { _id: '$author', count: { $sum: 1 } } }
          ]),
          Work.aggregate([
            { $match: { author: { $in: ids } } },
            { $group: { _id: '$author', count: { $sum: 1 } } }
          ])
        ])
        const noteMap = Object.fromEntries(noteCounts.map(x => [x._id.toString(), x.count]))
        const workMap = Object.fromEntries(workCounts.map(x => [x._id.toString(), x.count]))
        items = items.map(a => ({
          ...a,
          note_count: noteMap[a._id.toString()] || 0,
          work_count: workMap[a._id.toString()] || 0,
        }))
        break
      }

      case 'works': {
        items = await Work.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('author')
          .populate('piles')
          .lean()
          .exec()
        const ids = items.map(i => i._id)
        const noteCounts = await Note.aggregate([
          { $match: { work: { $in: ids } } },
          { $group: { _id: '$work', count: { $sum: 1 } } }
        ])
        const noteMap = Object.fromEntries(noteCounts.map(x => [x._id.toString(), x.count]))
        items = items.map(w => ({
          ...w,
          note_count: noteMap[w._id.toString()] || 0,
        }))
        break
      }

      case 'ideas': {
        items = await Idea.find({})
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean()
          .exec()
        const ids = items.map(i => i._id)
        const noteCounts = await Note.aggregate([
          { $match: { ideas: { $in: ids } } },
          { $group: { _id: { $arrayElemAt: ['$ideas', 0] }, count: { $sum: 1 } } }
        ])
        // ideas is an array field — need to unwind for accurate per-idea counts
        const ideaNoteCounts = await Note.aggregate([
          { $match: { ideas: { $in: ids } } },
          { $unwind: '$ideas' },
          { $match: { ideas: { $in: ids } } },
          { $group: { _id: '$ideas', count: { $sum: 1 } } }
        ])
        const noteMap = Object.fromEntries(ideaNoteCounts.map(x => [x._id.toString(), x.count]))
        items = items.map(i => ({
          ...i,
          note_count: noteMap[i._id.toString()] || 0,
        }))
        break
      }

      case 'piles': {
        items = await Pile.find({})
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean()
          .exec()
        const ids = items.map(i => i._id)
        const [noteAgg, workAgg] = await Promise.all([
          Note.aggregate([
            { $match: { piles: { $in: ids } } },
            { $unwind: '$piles' },
            { $match: { piles: { $in: ids } } },
            { $group: { _id: '$piles', count: { $sum: 1 } } }
          ]),
          Work.aggregate([
            { $match: { piles: { $in: ids } } },
            { $unwind: '$piles' },
            { $match: { piles: { $in: ids } } },
            { $group: { _id: '$piles', count: { $sum: 1 } } }
          ])
        ])
        const noteMap = Object.fromEntries(noteAgg.map(x => [x._id.toString(), x.count]))
        const workMap = Object.fromEntries(workAgg.map(x => [x._id.toString(), x.count]))
        items = items.map(p => ({
          ...p,
          note_count: noteMap[p._id.toString()] || 0,
          work_count: workMap[p._id.toString()] || 0,
        }))
        break
      }

      default:
        return res.status(400).json({ success: false, message: 'Invalid type' })
    }

    res.json({ success: true, data: items })
  } catch (error) {
    console.error('Error getting recent items:', error)
    res.status(500).json({ success: false, message: 'Error retrieving recent items' })
  }
}
