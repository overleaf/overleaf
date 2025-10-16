import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const deletedSubscriptionIndexes = [
  {
    key: {
      'subscription.groupPlan': 1,
    },
    name: 'subscription.groupPlan_1',
  },
]

const subscriptionIndexes = [
  {
    key: {
      groupPlan: 1,
    },
    name: 'groupPlan_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(
    db.deletedSubscriptions,
    deletedSubscriptionIndexes
  )

  await Helpers.addIndexesToCollection(db.subscriptions, subscriptionIndexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(
      db.deletedSubscriptions,
      deletedSubscriptionIndexes
    )
  } catch (err) {
    console.error(
      'Something went wrong rolling back the deletedSubscriptions migration',
      err
    )
  }

  try {
    await Helpers.dropIndexesFromCollection(
      db.subscriptions,
      subscriptionIndexes
    )
  } catch (err) {
    console.error(
      'Something went wrong rolling back the subscription migration',
      err
    )
  }
}

export default {
  tags,
  migrate,
  rollback,
}
