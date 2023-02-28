const mongoose = require('../infrastructure/Mongoose')
const { SubscriptionSchema } = require('./Subscription')

const { Schema } = mongoose
const { ObjectId } = Schema

const DeleterDataSchema = new Schema(
  {
    deleterId: { type: ObjectId, ref: 'User' },
    deleterIpAddress: { type: String },
    deletedAt: {
      type: Date,
      default() {
        return new Date()
      },
    },
  },
  { _id: false }
)

const DeletedSubscriptionSchema = new Schema(
  {
    deleterData: DeleterDataSchema,
    subscription: SubscriptionSchema,
  },
  { collection: 'deletedSubscriptions', minimize: false }
)

exports.DeletedSubscription = mongoose.model(
  'DeletedSubscription',
  DeletedSubscriptionSchema
)

exports.DeletedSubscriptionSchema = DeletedSubscriptionSchema
