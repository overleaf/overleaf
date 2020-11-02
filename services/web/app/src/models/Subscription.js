const mongoose = require('../infrastructure/Mongoose')
const { TeamInviteSchema } = require('./TeamInvite')

const { Schema } = mongoose
const { ObjectId } = Schema

const SubscriptionSchema = new Schema({
  admin_id: {
    type: ObjectId,
    ref: 'User',
    index: { unique: true, dropDups: true }
  },
  manager_ids: { type: [ObjectId], ref: 'User', required: true },
  member_ids: [{ type: ObjectId, ref: 'User' }],
  invited_emails: [String],
  teamInvites: [TeamInviteSchema],
  recurlySubscription_id: String,
  teamName: { type: String },
  teamNotice: { type: String },
  planCode: { type: String },
  groupPlan: { type: Boolean, default: false },
  membersLimit: { type: Number, default: 0 },
  customAccount: Boolean,
  overleaf: {
    id: {
      type: Number,
      index: {
        unique: true,
        partialFilterExpression: { 'overleaf.id': { $exists: true } }
      }
    }
  }
})

SubscriptionSchema.statics.findAndModify = function(query, update, callback) {
  const self = this
  return this.update(query, update, () => self.findOne(query, callback))
}

// Subscriptions have no v1 data to fetch
SubscriptionSchema.method('fetchV1Data', function(callback) {
  callback(null, this)
})

exports.Subscription = mongoose.model('Subscription', SubscriptionSchema)
exports.SubscriptionSchema = SubscriptionSchema
