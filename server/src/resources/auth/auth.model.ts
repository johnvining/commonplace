import mongoose, { Schema, Types } from 'mongoose'
import { markNotesStaleOnRename } from '../../utils/embeddingFreshness.js'

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
    name: { type: String, required: true, trim: true },
    birth_year: Number,
    death_year: Number,
    usernames: [{ type: String }],
  },
  { timestamps: true }
)

authSchema.index({ name: 1 })
authSchema.index({ usernames: 1 })

// Its name is part of its notes' embeddings (#373)
markNotesStaleOnRename(authSchema, ['authors', 'people'])

export const Auth = mongoose.model<AuthDoc>('author', authSchema)
