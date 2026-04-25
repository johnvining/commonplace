import mongoose from 'mongoose'

const authSchema = new mongoose.Schema(
  {
    name: String,
    birth_year: Number,
    death_year: Number
  },
  { timestamps: true }
)

authSchema.index({ name: 1 })

export const Auth = mongoose.model('author', authSchema)
