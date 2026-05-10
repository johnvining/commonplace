import mongoose from 'mongoose'

const authSchema = new mongoose.Schema(
  {
    name: String,
    birth_year: Number,
    death_year: Number,
    usernames: [{ type: String }]
  },
  { timestamps: true }
)

authSchema.index({ name: 1 })
authSchema.index({ usernames: 1 })

export const Auth = mongoose.model('author', authSchema)
