/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose
const { ObjectId } = Schema

const DocSchema = new Schema({
  name: { type: String, default: 'new doc' }
})

mongoose.model('Doc', DocSchema)
exports.Doc = mongoose.model('Doc')
exports.DocSchema = DocSchema
