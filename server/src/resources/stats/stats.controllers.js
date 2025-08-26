import Note from '../note/note.model'
import { Auth } from '../auth/auth.model'
import Idea from '../idea/idea.model'
import Work from '../work/work.model'

export const getStats = async (req, res) => {
  try {
    const [noteCount, authorCount, ideaCount, workCount] = await Promise.all([
      Note.countDocuments(),
      Auth.countDocuments(),
      Idea.countDocuments(),
      Work.countDocuments()
    ])

    res.json({
      success: true,
      data: {
        notes: noteCount,
        authors: authorCount,
        ideas: ideaCount,
        works: workCount
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
