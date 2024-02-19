import mongoose from 'mongoose'

const linkSchema = new mongoose.Schema(
  {
    left_note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'note',
    },
    right_note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'note',
    },
  },
  { timestamps: true }
)

export default mongoose.model('link', linkSchema)
