const mongoose = require('mongoose')

const { Schema } = mongoose

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
