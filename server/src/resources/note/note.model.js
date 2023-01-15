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
// TODO: Title not working
// TODO: How to refresh index?
noteSchema.index({ title: 'text', text: 'text', take: 'text' })

noteSchema.plugin(random, { path: 'r' })

// TODO: Add indices
export default mongoose.model('note', noteSchema)
