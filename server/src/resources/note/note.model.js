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
    year: Number,
    url: String,
    images: [{ type: String }],
    page: String,
    piles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pile' }],
    take: String
  },
  { timestamps: true }
)
noteSchema.index({ title: 'text', text: 'text', take: 'text' })

noteSchema.index({ author: 1 })
noteSchema.index({ work: 1 })
noteSchema.index({ piles: 1 })
noteSchema.index({ ideas: 1 })
noteSchema.index({ updatedAt: -1 })

export default mongoose.model('note', noteSchema)
