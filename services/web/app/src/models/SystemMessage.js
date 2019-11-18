const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose

const SystemMessageSchema = new Schema({
  content: { type: String, default: '' }
})

exports.SystemMessage = mongoose.model('SystemMessage', SystemMessageSchema)
