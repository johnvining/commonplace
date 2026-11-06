import mongoose, { Schema, Types } from 'mongoose'

// One signed-in browser or CLI (#375). A token names its session (jti)
// and the user's token version; it authenticates only while the session
// exists, isn't revoked and hasn't expired, and the version still
// matches. Logout revokes the session; a password change or "log out
// everywhere" bumps the user's version, cutting off every token.
export interface SessionDoc {
  _id: string
  user: Types.ObjectId
  createdAt: Date
  expiresAt: Date
  revokedAt?: Date
}

const sessionSchema = new Schema<SessionDoc>({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
})

// Mongo removes sessions a day after they expire
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

export default mongoose.model<SessionDoc>('session', sessionSchema)
