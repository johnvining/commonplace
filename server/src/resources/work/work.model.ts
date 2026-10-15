import mongoose, { Schema, Types } from 'mongoose'

export interface WorkDoc {
  _id: Types.ObjectId
  name?: string
  original_name?: string
  authors: Types.ObjectId[]
  url?: string
  year?: number
  citation_information?: string
  summary?: string
  piles: Types.ObjectId[]
  ideas: Types.ObjectId[]
  openCount?: number
  lastOpenedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const workSchema = new Schema<WorkDoc>(
  {
    name: { type: String, required: true, trim: true },
    // Title in the original language when `name` is a translation (#221).
    original_name: { type: String, trim: true },
    authors: [{ type: Schema.Types.ObjectId, ref: 'author' }],
    url: String,
    year: Number,
    citation_information: String,
    summary: String,
    piles: [{ type: Schema.Types.ObjectId, ref: 'pile' }],
    ideas: [{ type: Schema.Types.ObjectId, ref: 'idea' }],
    // How often its page has been opened, for the well-worn look (#333).
    openCount: { type: Number, default: 0 },
    lastOpenedAt: Date,
  },
  { timestamps: true }
)

workSchema.index({ name: 1 })
workSchema.index({ authors: 1 })
workSchema.index({ ideas: 1 })

export default mongoose.model<WorkDoc>('work', workSchema)
