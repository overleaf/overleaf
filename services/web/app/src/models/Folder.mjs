import mongoose from '../infrastructure/Mongoose.mjs'
import { DocSchema } from './Doc.mjs'
import { FileSchema } from './File.mjs'

const { Schema } = mongoose

export const FolderSchema = new Schema(
  {
    name: { type: String, default: 'new folder' },
  },
  { minimize: false }
)

FolderSchema.add({
  docs: [DocSchema],
  fileRefs: [FileSchema],
  folders: [FolderSchema],
})

export const Folder = mongoose.model('Folder', FolderSchema)
