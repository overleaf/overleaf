import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

const COLOR_REGEX = /^#[a-fA-F0-9]{6}$/

// Note that for legacy reasons, user_id and project_ids are plain strings,
// not ObjectIds.

export const TagSchema = new Schema(
  {
    user_id: { type: String, required: true },
    name: { type: String, required: true },
    color: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || COLOR_REGEX.test(v)
        },
        message: 'Provided color code is invalid.',
      },
    },
    project_ids: [String],
  },
  { minimize: false }
)

export const Tag = mongoose.model('Tag', TagSchema)
