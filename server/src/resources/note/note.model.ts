import mongoose, { Schema, Types } from 'mongoose'
import { mintNickOnCreate } from '../nick/nickLifecycle.js'
import { TEXT_SOURCES, trackTextSource, type TextSource } from '../../utils/noteText.js'
import { TITLE_SOURCES, trackTitleSource, type TitleSource } from '../../utils/noteTitle.js'
import { trackEmbeddingFreshness } from '../../utils/embeddingFreshness.js'

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
  textSource?: TextSource
  aiTitle?: string
  titleSource?: TitleSource
  openCount?: number
  lastOpenedAt?: Date
  reviewedAt?: Date
  reviewDueAt?: Date
  reviewInterval?: number
  reviewCount?: number
  embedding: number[]
  embeddingHash?: string
  embeddingStale?: boolean
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
    // Where `text` came from, so OCR never overwrites typed text (#379).
    // Kept up to date by trackTextSource; read it with textSourceOf.
    textSource: { type: String, enum: TEXT_SOURCES },
    // The last title suggested for this note. A save may mark its title
    // as AI-made only when it equals this (#330, #370); the mark itself
    // is titleSource.
    aiTitle: String,
    // Whether the title is the user's or AI's (#370). Missing means not
    // sure (saved before this existed). Kept up to date by
    // trackTitleSource; read it with titleSourceOf.
    titleSource: { type: String, enum: TITLE_SOURCES },
    // How often its page has been opened, for the well-worn look (#333).
    openCount: { type: Number, default: 0 },
    lastOpenedAt: Date,
    // Spaced review in /flip; see utils/review.ts. reviewCount > 0 means
    // reviewed. Only a rating sets these.
    reviewedAt: Date,
    reviewDueAt: Date,
    reviewInterval: Number,
    reviewCount: { type: Number, default: 0 },
    embedding: [Number],
    embeddingHash: String,
    // Set when the embedding inputs changed since the last embedding
    // (#373); see embeddingFreshness.ts
    embeddingStale: Boolean,
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
noteSchema.index({ reviewCount: 1 })

// Every new note gets its nick before the save returns (#367)
mintNickOnCreate(noteSchema, 'note')
trackTextSource(noteSchema)
trackTitleSource(noteSchema)
trackEmbeddingFreshness(noteSchema)

export default mongoose.model<NoteDoc>('note', noteSchema)
