import mongoose, { Schema, Types } from 'mongoose'

export interface AuthDoc {
  _id: Types.ObjectId
  name?: string
  birth_year?: number
  death_year?: number
  usernames: string[]
  createdAt: Date
  updatedAt: Date
}

const authSchema = new Schema<AuthDoc>(
  {
    name: String,
    birth_year: Number,
    death_year: Number,
    usernames: [{ type: String }],
  },
  { timestamps: true }
)

authSchema.index({ name: 1 })
authSchema.index({ usernames: 1 })

export const Auth = mongoose.model<AuthDoc>('author', authSchema)
