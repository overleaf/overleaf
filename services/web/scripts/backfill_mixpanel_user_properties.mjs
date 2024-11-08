// @ts-check
import '../app/src/models/User.js'
import { batchedUpdateWithResultHandling } from '@overleaf/mongo-utils/batchedUpdate.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import { getQueue } from '../app/src/infrastructure/Queues.js'
import SubscriptionLocator from '../app/src/Features/Subscription/SubscriptionLocator.js'
import PlansLocator from '../app/src/Features/Subscription/PlansLocator.js'
import FeaturesHelper from '../app/src/Features/Subscription/FeaturesHelper.js'
import { db } from '../app/src/infrastructure/mongodb.js'

const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY || '10', 10)

const mixpanelSinkQueue = getQueue('analytics-mixpanel-sink')

async function processUser(user) {
  const analyticsId = user.analyticsId || user._id

  await _sendPropertyToQueue(analyticsId, 'user-id', user._id)
  await _sendPropertyToQueue(analyticsId, 'analytics-id', analyticsId)
  await _sendPropertyToQueue(analyticsId, 'created-at', user.signUpDate)
  if (user.alphaProgram !== undefined) {
    await _sendPropertyToQueue(analyticsId, 'alpha-program', user.alphaProgram)
  }
  if (user.betaProgram !== undefined) {
    await _sendPropertyToQueue(analyticsId, 'beta-program', user.betaProgram)
  }

  const groupSubscriptionPlanCode = await _getGroupSubscriptionPlanCode(
    user._id
  )
  if (groupSubscriptionPlanCode) {
    await _sendPropertyToQueue(
      analyticsId,
      'group-subscription-plan-code',
      groupSubscriptionPlanCode
    )
  }

  const matchedFeatureSet = FeaturesHelper.getMatchedFeatureSet(user.features)
  if (matchedFeatureSet !== 'personal') {
    await _sendPropertyToQueue(analyticsId, 'feature-set', matchedFeatureSet)
  }

  if (user.splitTests) {
    for (const splitTestName of Object.keys(user.splitTests)) {
      const assignments = user.splitTests[splitTestName]
      if (Array.isArray(assignments)) {
        for (const assignment of assignments) {
          await _sendPropertyToQueue(
            analyticsId,
            `split-test-${splitTestName}-${assignment.versionNumber}`,
            `${assignment.variantName}`
          )
        }
      }
    }
  }
}

async function _getGroupSubscriptionPlanCode(userId) {
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

async function _sendPropertyToQueue(
  analyticsId,
  propertyName,
  propertyValue,
  createdAt = new Date()
) {
  if (propertyValue == null) {
    return
  }
  await mixpanelSinkQueue.add('user-property', {
    analyticsId,
    propertyName,
    propertyValue,
    createdAt,
  })
}

async function processBatch(_, users) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, users, async user => {
    await processUser(user)
  })
}

batchedUpdateWithResultHandling(
  db.users,
  {
    $nor: [
      { thirdPartyIdentifiers: { $exists: false } },
      { thirdPartyIdentifiers: { $size: 0 } },
    ],
  },
  processBatch,
  {
    _id: true,
    analyticsId: true,
    signUpDate: true,
    splitTests: true,
    alphaProgram: true,
    betaProgram: true,
  }
)
