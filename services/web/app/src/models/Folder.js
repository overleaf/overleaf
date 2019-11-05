const mongoose = require('mongoose')
const { DocSchema } = require('./Doc')
const { FileSchema } = require('./File')

const { Schema } = mongoose

const FolderSchema = new Schema({
  name: { type: String, default: 'new folder' }
})

FolderSchema.add({
  docs: [DocSchema],
  fileRefs: [FileSchema],
  folders: [FolderSchema]
})

mongoose.model('Folder', FolderSchema)
exports.Folder = mongoose.model('Folder')
exports.FolderSchema = FolderSchema
