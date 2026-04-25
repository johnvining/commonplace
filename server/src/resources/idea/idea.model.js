import mongoose from 'mongoose'

const ideaSchema = new mongoose.Schema(
  {
    name: String,
    start_year: Number,
    end_year: Number
  },
  { timestamps: true }
)

ideaSchema.index({ name: 1 })

export default mongoose.model('idea', ideaSchema)
