import mongoose from 'mongoose'

// TODO: Add year
// TODO: Add author
const workSchema = new mongoose.Schema(
  {
    name: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'author'
    },
    url: String,
    year: Number
  },
  { timestamps: true }
)

// TODO: Add indices
export default mongoose.model('work', workSchema)
