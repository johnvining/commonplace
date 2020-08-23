import mongoose from 'mongoose'

const authSchema = new mongoose.Schema(
  {
    name: String
  },
  { timestamps: true }
)

// TODO: Add indices
export const Auth = mongoose.model('author', authSchema)
