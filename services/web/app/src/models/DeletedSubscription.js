const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')
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
      }
    }
  },
  { _id: false }
)

const DeletedSubscriptionSchema = new Schema(
  {
    deleterData: DeleterDataSchema,
    subscription: SubscriptionSchema
  },
  { collection: 'deletedSubscriptions' }
)

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const DeletedSubscription = conn.model(
  'DeletedSubscription',
  DeletedSubscriptionSchema
)

mongoose.model('DeletedSubscription', DeletedSubscriptionSchema)
exports.DeletedSubscription = DeletedSubscription
exports.DeletedSubscriptionSchema = DeletedSubscriptionSchema
