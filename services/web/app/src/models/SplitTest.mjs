import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose
const { ObjectId } = Schema

const MIN_NAME_LENGTH = 3
const MAX_NAME_LENGTH = 200
const MIN_VARIANT_NAME_LENGTH = 3
const MAX_VARIANT_NAME_LENGTH = 255
const NAME_REGEX = /^[a-z0-9-]+$/

const RolloutPercentType = {
  type: Number,
  default: 0,
  min: [0, 'Rollout percentage must be between 0 and 100, got {VALUE}'],
  max: [100, 'Rollout percentage must be between 0 and 100, got {VALUE}'],
  required: true,
}

const BadgeSchema = new Schema(
  {
    tooltipText: {
      type: String,
      required: false,
    },
    url: {
      type: String,
      required: false,
    },
  },
  { _id: false }
)

const BadgeInfoSchema = new Schema(
  {
    alpha: BadgeSchema,
    beta: BadgeSchema,
    release: BadgeSchema,
  },
  { _id: false }
)

const VariantSchema = new Schema(
  {
    name: {
      type: String,
      minLength: MIN_VARIANT_NAME_LENGTH,
      maxLength: MAX_VARIANT_NAME_LENGTH,
      required: true,
      validate: {
        validator: function (input) {
          return input !== null && input !== 'default' && NAME_REGEX.test(input)
        },
        message: `invalid, cannot be 'default' and must match: ${NAME_REGEX}, got {VALUE}`,
      },
    },
    rolloutPercent: RolloutPercentType,
    rolloutStripes: [
      {
        start: RolloutPercentType,
        end: RolloutPercentType,
      },
    ],
    userLimit: {
      type: Number,
      min: [0, 'User limit must be 0 or greater, got {VALUE}'],
      required: false,
    },
    userCount: {
      type: Number,
      min: [0, 'User count must be 0 or greater, got {VALUE}'],
      required: false,
    },
  },
  { _id: false }
)

const VersionSchema = new Schema(
  {
    versionNumber: {
      type: Number,
      default: 1,
      min: [1, 'must be 1 or higher, got {VALUE}'],
      required: true,
    },
    phase: {
      type: String,
      default: 'alpha',
      enum: ['alpha', 'beta', 'release'],
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
    },
    analyticsEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    variants: [VariantSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    author: { type: ObjectId, ref: 'User' },
    comment: {
      type: String,
      required: false,
    },
  },
  { _id: false }
)

export const SplitTestSchema = new Schema(
  {
    name: {
      type: String,
      minLength: MIN_NAME_LENGTH,
      maxlength: MAX_NAME_LENGTH,
      required: true,
      unique: true,
      validate: {
        validator: function (input) {
          return input !== null && NAME_REGEX.test(input)
        },
        message: `invalid, must match: ${NAME_REGEX}`,
      },
    },
    versions: [VersionSchema],
    forbidReleasePhase: {
      type: Boolean,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    expectedEndDate: {
      type: Date,
      required: false,
    },
    requiredCohortSize: {
      type: Number,
      required: false,
    },
    expectedUplift: {
      type: Number,
      required: false,
    },
    ticketUrl: {
      type: String,
      required: false,
    },
    reportsUrls: {
      type: [String],
      required: false,
      default: [],
    },
    winningVariant: {
      type: String,
      required: false,
    },
    archived: {
      type: Boolean,
      required: false,
    },
    archivedAt: {
      type: Date,
      required: false,
    },
    archivedBy: { type: ObjectId, ref: 'User' },
    badgeInfo: {
      type: BadgeInfoSchema,
      required: false,
    },
  },
  { minimize: false }
)

export const SplitTest = mongoose.model('SplitTest', SplitTestSchema)
