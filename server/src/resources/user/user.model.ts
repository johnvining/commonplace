import mongoose, { Schema, Types } from 'mongoose'

export interface UserDoc {
  _id: Types.ObjectId
  username: string
  password: string
  role?: string
  // Bumped to cut off every outstanding token (#375)
  tokenVersion: number
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<UserDoc>(
  {
    username: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export default mongoose.model<UserDoc>('user', userSchema)
