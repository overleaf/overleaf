const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose

const SystemMessageSchema = new Schema(
  {
    content: { type: String, default: '' },
  },
  { minimize: false }
)

exports.SystemMessage = mongoose.model('SystemMessage', SystemMessageSchema)
