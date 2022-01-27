const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

const { batchedUpdateWithResultHandling } = require('./helpers/batchedUpdate')
const { promiseMapWithLimit } = require('../app/src/util/promises')
const SubscriptionLocator = require('../app/src/Features/Subscription/SubscriptionLocator')
const PlansLocator = require('../app/src/Features/Subscription/PlansLocator')
const FeaturesHelper = require('../app/src/Features/Subscription/FeaturesHelper')
const AnalyticsManager = require('../app/src/Features/Analytics/AnalyticsManager')

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

async function processBatch(_, users) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, users, async user => {
    await processUser(user)
  })
}

batchedUpdateWithResultHandling('users', {}, processBatch, {
  _id: true,
  analyticsId: true,
  features: true,
})
