import mongoose, { Schema, Types } from 'mongoose'

export interface IdeaDoc {
  _id: Types.ObjectId
  name?: string
  start_year?: number
  end_year?: number
  createdAt: Date
  updatedAt: Date
}

const ideaSchema = new Schema<IdeaDoc>(
  {
    name: String,
    start_year: Number,
    end_year: Number,
  },
  { timestamps: true }
)

ideaSchema.index({ name: 1 })

export default mongoose.model<IdeaDoc>('idea', ideaSchema)
