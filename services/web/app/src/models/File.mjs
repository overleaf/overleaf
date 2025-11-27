import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const FileSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    created: {
      type: Date,
      default() {
        return new Date()
      },
    },
    rev: { type: Number, default: 0 },
    linkedFileData: { type: Schema.Types.Mixed },
    hash: {
      type: String,
    },
  },
  { minimize: false }
)

export const File = mongoose.model('File', FileSchema)
