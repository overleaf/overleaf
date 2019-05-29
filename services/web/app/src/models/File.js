/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose
const { ObjectId } = Schema

const FileSchema = new Schema({
  name: {
    type: String,
    default: ''
  },
  created: {
    type: Date,
    default() {
      return new Date()
    }
  },
  rev: { type: Number, default: 0 },
  linkedFileData: { type: Schema.Types.Mixed },
  hash: {
    type: String
  }
})

mongoose.model('File', FileSchema)
exports.File = mongoose.model('File')
exports.FileSchema = FileSchema
