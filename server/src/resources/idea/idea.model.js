import mongoose from 'mongoose'

const ideaSchema = new mongoose.Schema(
  {
    name: String,
    start_year: Number,
    end_year: Number
  },
  { timestamps: true }
)

// TODO: Add indices
export default mongoose.model('idea', ideaSchema)
