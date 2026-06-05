import { db } from './lib/mongodb.mjs'

const tags = ['saas']

const migrate = async () => {
  const result = await db.subscriptions.updateMany(
    {
      recurlySubscription_id: /^sub_/,
      $expr: {
        $eq: ['$recurlySubscription_id', '$paymentProvider.subscriptionId'],
      },
    },
    { $unset: { recurlySubscription_id: '' } }
  )
  console.log(
    `Updated ${result.modifiedCount} subscriptions (matched ${result.matchedCount}).`
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
