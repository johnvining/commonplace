import mongoose from 'mongoose'

const nickSchema = new mongoose.Schema(
  {
    key: String,
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'note'
    },
    idea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'idea'
    },
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'work'
    }
  },
  { timestamps: true }
)

export default mongoose.model('nick', nickSchema)
