import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

// Support hex colours and the auto-generated HSL colours based on IDs
export const TAG_COLOR_REGEX = /^(#[a-fA-F0-9]{6}|hsl\(\d{1,3}, 70%, 45%\))$/

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
          return !v || TAG_COLOR_REGEX.test(v)
        },
        message: 'Provided color code is invalid.',
      },
    },
    project_ids: [String],
  },
  { minimize: false }
)

export const Tag = mongoose.model('Tag', TagSchema)
