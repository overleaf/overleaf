const mongoose = require('mongoose')

const { Schema } = mongoose

const DocSchema = new Schema({
  name: { type: String, default: 'new doc' }
})

mongoose.model('Doc', DocSchema)
exports.Doc = mongoose.model('Doc')
exports.DocSchema = DocSchema
