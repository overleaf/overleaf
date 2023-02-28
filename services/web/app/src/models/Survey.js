const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const MIN_NAME_LENGTH = 3
const MAX_NAME_LENGTH = 200
const NAME_REGEX = /^[a-z0-9-]+$/

const SurveySchema = new Schema(
  {
    name: {
      type: String,
      minLength: MIN_NAME_LENGTH,
      maxlength: MAX_NAME_LENGTH,
      required: true,
      validate: {
        validator: function (input) {
          return input !== null && NAME_REGEX.test(input)
        },
        message: `invalid, must match: ${NAME_REGEX}`,
      },
    },
    preText: {
      type: String,
      required: true,
    },
    linkText: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    options: {
      hasRecurlyGroupSubscription: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    collection: 'surveys',
    minimize: false,
  }
)

module.exports = {
  Survey: mongoose.model('Survey', SurveySchema),
  SurveySchema,
}
