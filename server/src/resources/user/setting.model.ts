import mongoose, { Schema } from 'mongoose'

// Small app-wide flags, one document each
export interface SettingDoc {
  _id: string
  value: unknown
}

const settingSchema = new Schema<SettingDoc>({
  _id: { type: String, required: true },
  value: Schema.Types.Mixed,
})

export default mongoose.model<SettingDoc>('setting', settingSchema)
