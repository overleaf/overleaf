const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

// Note that for legacy reasons, user_id and project_ids are plain strings,
// not ObjectIds.

const TagSchema = new Schema({
  user_id: { type: String, required: true },
  name: { type: String, required: true },
  project_ids: [String],
})

exports.Tag = mongoose.model('Tag', TagSchema)
exports.TagSchema = TagSchema
