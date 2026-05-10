import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema(
  {
    name: String,
    start_year: Number,
    end_year: Number
  },
  { timestamps: true }
)

noteSchema.index({ name: 1 })

export default mongoose.model('pile', noteSchema)
