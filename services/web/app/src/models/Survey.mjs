import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

const MIN_NAME_LENGTH = 3
const MAX_NAME_LENGTH = 200
const NAME_REGEX = /^[a-z0-9-]+$/

export const SurveySchema = new Schema(
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
    title: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    cta: {
      type: String,
      required: false,
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
      earliestSignupDate: {
        type: Date,
      },
      latestSignupDate: {
        type: Date,
      },
      rolloutPercentage: {
        type: Number,
        default: 100,
      },
      excludeLabsUsers: {
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

export const Survey = mongoose.model('Survey', SurveySchema)
