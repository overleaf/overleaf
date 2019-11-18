const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose

const DocSchema = new Schema({
  name: { type: String, default: 'new doc' }
})

exports.Doc = mongoose.model('Doc', DocSchema)

exports.DocSchema = DocSchema
