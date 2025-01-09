const mongoose = require('../infrastructure/Mongoose')
const { TeamInviteSchema } = require('./TeamInvite')

const { Schema } = mongoose
const { ObjectId } = Schema

const SubscriptionSchema = new Schema(
  {
    admin_id: {
      type: ObjectId,
      ref: 'User',
      index: { unique: true, dropDups: true },
    },
    manager_ids: {
      type: [ObjectId],
      ref: 'User',
      required: true,
      validate: function (managers) {
        // require at least one manager
        return !!managers.length
      },
    },
    member_ids: [{ type: ObjectId, ref: 'User' }],
    groupPolicy: { type: ObjectId, ref: 'GroupPolicy' },
    invited_emails: [String],
    teamInvites: [TeamInviteSchema],
    recurlySubscription_id: String,
    teamName: { type: String },
    teamNotice: { type: String },
    planCode: { type: String },
    groupPlan: { type: Boolean, default: false },
    managedUsersEnabled: { type: Boolean, default: false },
    membersLimit: { type: Number, default: 0 },
    customAccount: Boolean,
    features: {
      managedUsers: { type: Boolean, default: true },
      groupSSO: { type: Boolean, default: true },
    },
    addOns: Schema.Types.Mixed,
    overleaf: {
      id: {
        type: Number,
        index: {
          unique: true,
          partialFilterExpression: { 'overleaf.id': { $exists: true } },
        },
      },
    },
    recurlyStatus: {
      state: {
        type: String,
      },
      trialStartedAt: {
        type: Date,
      },
      trialEndsAt: {
        type: Date,
      },
    },
    collectionMethod: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'automatic',
    },
    v1_id: {
      type: Number,
      required: false,
      min: 1,
    },
    salesforce_id: {
      type: String,
      required: false,
      validate: {
        validator: function (salesforceId) {
          return (
            salesforceId == null ||
            salesforceId === '' ||
            salesforceId.match(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/)
          )
        },
      },
    },
    ssoConfig: { type: ObjectId, ref: 'SSOConfig' },
  },
  { minimize: false }
)

// Subscriptions have no v1 data to fetch
SubscriptionSchema.method('fetchV1Data', function (callback) {
  callback(null, this)
})

exports.Subscription = mongoose.model('Subscription', SubscriptionSchema)
exports.SubscriptionSchema = SubscriptionSchema
