import mongoose from 'mongoose'

const authSchema = new mongoose.Schema(
  {
    name: String,
    birth_year: Number,
    death_year: Number
  },
  { timestamps: true }
)

// TODO: Add indices
export const Auth = mongoose.model('author', authSchema)
