import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema(
  {
    title: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'author'
    },
    text: String,
    ideas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'idea' }],
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'work'
    },
    year: Number
  },
  { timestamps: true }
)
// TODO: Title not working
// TODO: How to refresh index?
noteSchema.index({ title: 'text', text: 'text' })

// TODO: Add indices
export default mongoose.model('note', noteSchema)
