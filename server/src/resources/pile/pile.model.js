import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema(
  {
    name: String
  },
  { timestamps: true }
)

export default mongoose.model('pile', noteSchema)
