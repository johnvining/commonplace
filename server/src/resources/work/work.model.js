import mongoose from 'mongoose'

// TODO: Add year
// TODO: Add author
const ideaSchema = new mongoose.Schema(
  {
    name: String
  },
  { timestamps: true }
)

// TODO: Add indices
export default mongoose.model('work', ideaSchema)
