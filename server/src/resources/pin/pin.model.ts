import mongoose, { Schema, Types } from 'mongoose'

// A starred item, shown in the sidebar. Stored here (not just in the
// browser) so stars sync across devices.
export interface PinDoc {
  _id: Types.ObjectId
  type: string
  target: string
  label?: string
  href?: string
  pinnedAt: Date
}

const pinSchema = new Schema<PinDoc>({
  type: { type: String, required: true },
  // The starred record's id (a note, work, author, idea or pile).
  target: { type: String, required: true },
  label: String,
  href: String,
  pinnedAt: { type: Date, default: () => new Date() },
})

pinSchema.index({ type: 1, target: 1 }, { unique: true })
pinSchema.index({ pinnedAt: -1 })

export default mongoose.model<PinDoc>('pin', pinSchema)
