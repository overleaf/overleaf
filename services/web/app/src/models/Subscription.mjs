import mongoose from '../infrastructure/Mongoose.mjs'
import { TeamInviteSchema } from './TeamInvite.mjs'
import { callbackify } from '@overleaf/promise-utils'

const { Schema } = mongoose
const { ObjectId } = Schema

const PaymentProvider = {
  service: {
    type: String,
  },
  subscriptionId: {
    type: String,
  },
  state: {
    type: String,
  },
  pausePeriodStart: {
    type: Date,
  },
  pausePeriodEnd: {
    type: Date,
  },
  trialStartedAt: {
    type: Date,
  },
  trialEndsAt: {
    type: Date,
  },
}

export const SubscriptionSchema = new Schema(
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
    lastSuccesfulSubscription: {
      planCode: {
        type: String,
      },
      addOns: Schema.Types.Mixed,
    },
    timesRevertedDueToFailedPayment: { type: Number, default: 0 },
    teamName: { type: String },
    teamNotice: { type: String },
    planCode: { type: String },
    groupPlan: { type: Boolean, default: false },
    domainCaptureEnabled: { type: Boolean, default: false },
    managedUsersEnabled: { type: Boolean, default: false },
    membersLimit: { type: Number, default: 0 },
    membersLimitNotificationSent: { type: Boolean, default: false },
    customAccount: Boolean,
    features: {
      managedUsers: { type: Boolean, default: true },
      groupSSO: { type: Boolean, default: true },
      domainCapture: { type: Boolean, default: false },
    },
    userFeaturesDisabled: Boolean,
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
    paymentProvider: PaymentProvider,
    previousPaymentProvider: PaymentProvider,
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
async function fetchV1DataPromise() {
  return this
}
SubscriptionSchema.method('fetchV1Data', callbackify(fetchV1DataPromise))

SubscriptionSchema.method('fetchV1DataPromise', fetchV1DataPromise)

export const Subscription = mongoose.model('Subscription', SubscriptionSchema)
