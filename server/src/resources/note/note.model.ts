import mongoose, { Schema, Types } from 'mongoose'

export interface NoteDoc {
  _id: Types.ObjectId
  title?: string
  authors: Types.ObjectId[]
  people: Types.ObjectId[]
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
  aiTitle?: string
  openCount?: number
  lastOpenedAt?: Date
  embedding: number[]
  embeddingHash?: string
  createdAt: Date
  updatedAt: Date
}

const noteSchema = new Schema<NoteDoc>(
  {
    title: String,
    authors: [{ type: Schema.Types.ObjectId, ref: 'author' }],
    // People the note is about (#246), as opposed to who wrote it.
    people: [{ type: Schema.Types.ObjectId, ref: 'author' }],
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
    // The last title suggested for this note. While the title still
    // equals it, the title is marked as AI-generated (#330); editing the
    // title clears the mark.
    aiTitle: String,
    // How often its page has been opened, for the well-worn look (#333).
    openCount: { type: Number, default: 0 },
    lastOpenedAt: Date,
    embedding: [Number],
    embeddingHash: String,
  },
  { timestamps: true }
)
noteSchema.index({ people: 1 })
noteSchema.index({ title: 'text', text: 'text', take: 'text', ocrText: 'text' })

noteSchema.index({ authors: 1 })
noteSchema.index({ work: 1 })
noteSchema.index({ piles: 1 })
noteSchema.index({ ideas: 1 })
noteSchema.index({ updatedAt: -1 })

export default mongoose.model<NoteDoc>('note', noteSchema)
