const mongoose = require('../infrastructure/Mongoose')

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

exports.File = mongoose.model('File', FileSchema)
exports.FileSchema = FileSchema
