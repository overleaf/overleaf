/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')
const { DocSchema } = require('./Doc')
const { FileSchema } = require('./File')

const { Schema } = mongoose
const { ObjectId } = Schema

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
