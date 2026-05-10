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

export default mongoose.model<LinkDoc>('link', linkSchema)
