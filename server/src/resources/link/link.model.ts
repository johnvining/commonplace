import mongoose, { Schema, Types } from 'mongoose'

export interface LinkDoc {
  _id: Types.ObjectId
  left_note?: Types.ObjectId
  right_note?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const linkSchema = new Schema<LinkDoc>(
  {
    left_note: { type: Schema.Types.ObjectId, ref: 'note' },
    right_note: { type: Schema.Types.ObjectId, ref: 'note' },
  },
  { timestamps: true }
)

linkSchema.index({ left_note: 1 })
linkSchema.index({ right_note: 1 })
// Links are undirected and stored with the smaller note id on the left
// (see canonicalPair), so one pair can only be stored once (#371). On a
// database with duplicate or reversed links this index can't build until
// the "Tidy note links" maintenance task has run.
linkSchema.index({ left_note: 1, right_note: 1 }, { unique: true })

export default mongoose.model<LinkDoc>('link', linkSchema)
