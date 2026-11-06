import mongoose, { Schema, Types } from 'mongoose'
import { mintNickOnCreate } from '../nick/nickLifecycle.js'

export interface IdeaDoc {
  _id: Types.ObjectId
  name?: string
  start_year?: number
  end_year?: number
  text?: string
  person?: boolean
  createdAt: Date
  updatedAt: Date
}

const ideaSchema = new Schema<IdeaDoc>(
  {
    name: { type: String, required: true, trim: true },
    start_year: Number,
    end_year: Number,
    // Free-form overview notes (#317).
    text: String,
    // Marks an idea that is a person (#313).
    person: { type: Boolean, default: false },
  },
  { timestamps: true }
)

ideaSchema.index({ name: 1 })

// Every new idea gets its nick before the save returns (#367)
mintNickOnCreate(ideaSchema, 'idea')

export default mongoose.model<IdeaDoc>('idea', ideaSchema)
