import mongoose from 'mongoose'

const workSchema = new mongoose.Schema(
  {
    name: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'author'
    },
    url: String,
    year: Number,
    citation_information: String,
    summary: String,
    piles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pile' }]
  },
  { timestamps: true }
)

workSchema.index({ name: 1 })
workSchema.index({ author: 1 })

export default mongoose.model('work', workSchema)
