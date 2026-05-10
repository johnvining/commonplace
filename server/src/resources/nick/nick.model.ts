import mongoose, { Schema, Types } from 'mongoose'

export interface NickDoc {
  _id: Types.ObjectId
  key?: string
  note?: Types.ObjectId
  idea?: Types.ObjectId
  work?: Types.ObjectId
  pile?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const nickSchema = new Schema<NickDoc>(
  {
    key: String,
    note: { type: Schema.Types.ObjectId, ref: 'note' },
    idea: { type: Schema.Types.ObjectId, ref: 'idea' },
    work: { type: Schema.Types.ObjectId, ref: 'work' },
    pile: { type: Schema.Types.ObjectId, ref: 'pile' },
  },
  { timestamps: true }
)

nickSchema.index({ key: 1 }, { unique: true, sparse: true })
nickSchema.index({ note: 1 }, { unique: true, sparse: true })
nickSchema.index({ work: 1 }, { unique: true, sparse: true })
nickSchema.index({ idea: 1 }, { unique: true, sparse: true })
nickSchema.index({ pile: 1 }, { unique: true, sparse: true })

export default mongoose.model<NickDoc>('nick', nickSchema)
