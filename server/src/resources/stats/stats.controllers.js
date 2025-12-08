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
          .populate('author')
          .populate('ideas')
          .populate('piles')
          .populate({
            path: 'work',
            populate: { path: 'author' }
          })
          .lean()
          .exec()
        break
      case 'authors':
        items = await Auth.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec()
        // Add counts for authors
        const authorNotePromises = items.map(author => 
          Note.find({ author: author._id }).countDocuments()
        )
        const authorWorkPromises = items.map(author => 
          Work.find({ author: author._id }).countDocuments()
        )
        const authorNoteCounts = await Promise.all(authorNotePromises)
        const authorWorkCounts = await Promise.all(authorWorkPromises)
        items = items.map((author, idx) => ({
          ...author,
          note_count: authorNoteCounts[idx],
          work_count: authorWorkCounts[idx]
        }))
        break
      case 'works':
        items = await Work.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('author')
          .populate('piles')
          .lean()
          .exec()
        // Add note counts for works
        const workNotePromises = items.map(work => 
          Note.find({ work: work._id }).countDocuments()
        )
        const workNoteCounts = await Promise.all(workNotePromises)
        items = items.map((work, idx) => ({
          ...work,
          note_count: workNoteCounts[idx]
        }))
        break
      case 'ideas':
        items = await Idea.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec()
        // Add note counts for ideas
        const ideaNotePromises = items.map(idea => 
          Note.find({ ideas: idea._id }).countDocuments()
        )
        const ideaNoteCounts = await Promise.all(ideaNotePromises)
        items = items.map((idea, idx) => ({
          ...idea,
          note_count: ideaNoteCounts[idx]
        }))
        break
      case 'piles':
        items = await Pile.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec()
        // Add counts for piles
        const pileNotePromises = items.map(pile => 
          Note.find({ piles: pile._id }).countDocuments()
        )
        const pileWorkPromises = items.map(pile => 
          Work.find({ piles: pile._id }).countDocuments()
        )
        const pileNoteCounts = await Promise.all(pileNotePromises)
        const pileWorkCounts = await Promise.all(pileWorkPromises)
        items = items.map((pile, idx) => ({
          ...pile,
          note_count: pileNoteCounts[idx],
          work_count: pileWorkCounts[idx]
        }))
        break
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid type'
        })
    }

    res.json({
      success: true,
      data: items
    })
  } catch (error) {
    console.error('Error getting recent items:', error)
    res.status(500).json({
      success: false,
      message: 'Error retrieving recent items'
    })
  }
}
