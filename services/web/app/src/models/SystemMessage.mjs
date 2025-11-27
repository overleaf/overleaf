import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

const SystemMessageSchema = new Schema(
  {
    content: { type: String, default: '' },
  },
  { minimize: false }
)

export const SystemMessage = mongoose.model(
  'SystemMessage',
  SystemMessageSchema
)
