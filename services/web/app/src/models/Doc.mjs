import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const DocSchema = new Schema(
  {
    name: { type: String, default: 'new doc' },
  },
  { minimize: false }
)

export const Doc = mongoose.model('Doc', DocSchema)
