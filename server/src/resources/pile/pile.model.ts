import mongoose, { Schema, Types } from 'mongoose'

export interface PileDoc {
  _id: Types.ObjectId
  name?: string
  start_year?: number
  end_year?: number
  createdAt: Date
  updatedAt: Date
}

const pileSchema = new Schema<PileDoc>(
  {
    name: { type: String, required: true, trim: true },
    start_year: Number,
    end_year: Number,
  },
  { timestamps: true }
)

pileSchema.index({ name: 1 })

export default mongoose.model<PileDoc>('pile', pileSchema)
