import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema(
  {
    title: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'author'
    },
    text: String,
    ideas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'idea' }]
  },
  { timestamps: true }
)

// TODO: Add indices
export default mongoose.model('note', noteSchema)
