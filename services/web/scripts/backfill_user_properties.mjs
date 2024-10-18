import BatchedUpdateModule from './helpers/batchedUpdate.mjs'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import SubscriptionLocator from '../app/src/Features/Subscription/SubscriptionLocator.js'
import PlansLocator from '../app/src/Features/Subscription/PlansLocator.js'
import FeaturesHelper from '../app/src/Features/Subscription/FeaturesHelper.js'
import AnalyticsManager from '../app/src/Features/Analytics/AnalyticsManager.js'

const { batchedUpdateWithResultHandling } = BatchedUpdateModule

const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

async function getGroupSubscriptionPlanCode(userId) {
  const subscriptions =
    await SubscriptionLocator.promises.getMemberSubscriptions(userId)
  let bestPlanCode = null
  let bestFeatures = {}
  for (const subscription of subscriptions) {
    const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
    if (
      plan &&
      FeaturesHelper.isFeatureSetBetter(plan.features, bestFeatures)
    ) {
      bestPlanCode = plan.planCode
      bestFeatures = plan.features
    }
  }
  return bestPlanCode
}

async function processUser(user) {
  const analyticsId = user.analyticsId || user._id

  const groupSubscriptionPlanCode = await getGroupSubscriptionPlanCode(user._id)
  if (groupSubscriptionPlanCode) {
    await AnalyticsManager.setUserPropertyForAnalyticsId(
      analyticsId,
      'group-subscription-plan-code',
      groupSubscriptionPlanCode
    )
  }

  const matchedFeatureSet = FeaturesHelper.getMatchedFeatureSet(user.features)
  if (matchedFeatureSet !== 'personal') {
    await AnalyticsManager.setUserPropertyForAnalyticsId(
      analyticsId,
      'feature-set',
      matchedFeatureSet
    )
  }
}

async function processBatch(users) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, users, async user => {
    await processUser(user)
  })
}

batchedUpdateWithResultHandling('users', {}, processBatch, {
  _id: true,
  analyticsId: true,
  features: true,
})
