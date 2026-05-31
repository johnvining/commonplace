import mongoose, { Schema, Types } from 'mongoose'

export interface NoteDoc {
  _id: Types.ObjectId
  title?: string
  authors: Types.ObjectId[]
  text?: string
  ideas: Types.ObjectId[]
  work?: Types.ObjectId
  year?: number
  url?: string
  images: string[]
  page?: string
  piles: Types.ObjectId[]
  take?: string
  ocrText?: string
  embedding: number[]
  embeddingHash?: string
  createdAt: Date
  updatedAt: Date
}

const noteSchema = new Schema<NoteDoc>(
  {
    title: String,
    authors: [{ type: Schema.Types.ObjectId, ref: 'author' }],
    text: String,
    ideas: [{ type: Schema.Types.ObjectId, ref: 'idea' }],
    work: {
      type: Schema.Types.ObjectId,
      ref: 'work',
    },
    year: Number,
    url: String,
    images: [{ type: String }],
    page: String,
    piles: [{ type: Schema.Types.ObjectId, ref: 'pile' }],
    take: String,
    ocrText: String,
    embedding: [Number],
    embeddingHash: String,
  },
  { timestamps: true }
)
noteSchema.index({ title: 'text', text: 'text', take: 'text', ocrText: 'text' })

noteSchema.index({ authors: 1 })
noteSchema.index({ work: 1 })
noteSchema.index({ piles: 1 })
noteSchema.index({ ideas: 1 })
noteSchema.index({ updatedAt: -1 })

export default mongoose.model<NoteDoc>('note', noteSchema)
