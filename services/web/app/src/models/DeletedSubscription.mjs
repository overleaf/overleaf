import mongoose from '../infrastructure/Mongoose.mjs'
import { SubscriptionSchema } from './Subscription.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

export const DeleterDataSchema = new Schema(
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

export const DeletedSubscription = mongoose.model(
  'DeletedSubscription',
  DeletedSubscriptionSchema
)
