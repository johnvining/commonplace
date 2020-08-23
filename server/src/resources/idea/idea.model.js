import mongoose from 'mongoose'

const ideaSchema = new mongoose.Schema(
  {
    name: String
  },
  { timestamps: true }
)

// TODO: Add indices
export default mongoose.model('idea', ideaSchema)
