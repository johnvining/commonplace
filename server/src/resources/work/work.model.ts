import mongoose, { Schema, Types } from 'mongoose'

export interface WorkDoc {
  _id: Types.ObjectId
  name?: string
  authors: Types.ObjectId[]
  url?: string
  year?: number
  citation_information?: string
  summary?: string
  piles: Types.ObjectId[]
  ideas: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const workSchema = new Schema<WorkDoc>(
  {
    name: { type: String, required: true, trim: true },
    authors: [{ type: Schema.Types.ObjectId, ref: 'author' }],
    url: String,
    year: Number,
    citation_information: String,
    summary: String,
    piles: [{ type: Schema.Types.ObjectId, ref: 'pile' }],
    ideas: [{ type: Schema.Types.ObjectId, ref: 'idea' }],
  },
  { timestamps: true }
)

workSchema.index({ name: 1 })
workSchema.index({ authors: 1 })
workSchema.index({ ideas: 1 })

export default mongoose.model<WorkDoc>('work', workSchema)
