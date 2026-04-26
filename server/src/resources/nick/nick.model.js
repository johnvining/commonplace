import mongoose from 'mongoose'

const nickSchema = new mongoose.Schema(
  {
    key: String,
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'note',
    },
    idea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'idea',
    },
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'work',
    },
    pile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'pile',
    },
  },
  { timestamps: true }
)

nickSchema.index({ key: 1 }, { unique: true, sparse: true })
nickSchema.index({ note: 1 }, { unique: true, sparse: true })
nickSchema.index({ work: 1 }, { unique: true, sparse: true })
nickSchema.index({ idea: 1 }, { unique: true, sparse: true })
nickSchema.index({ pile: 1 }, { unique: true, sparse: true })

export default mongoose.model('nick', nickSchema)
