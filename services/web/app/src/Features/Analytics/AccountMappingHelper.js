const mappings = new Map([
  ['salesforce_id', generateSubscriptionToSalesforceMapping],
  ['v1_id', generateSubscriptionToV1Mapping],
  ['recurlySubscription_id', generateSubscriptionToRecurlyMapping],
])

/**
 * @typedef {(import('./types.d.ts').AccountMapping)} AccountMapping
 */

/**
 *
 * @param {Object} subscription
 * @param {Object} updatedSubscription
 * @return {Array<AccountMapping>}
 */
function extractAccountMappingsFromSubscription(
  subscription,
  updatedSubscription
) {
  const accountMappings = []
  mappings.forEach((generateMapping, param) => {
    if (updatedSubscription[param] || updatedSubscription[param] === '') {
      if (subscription[param] !== updatedSubscription[param]) {
        accountMappings.push(
          generateMapping(subscription.id, updatedSubscription[param])
        )
      }
    }
  })
  return accountMappings
}

function generateV1Mapping(v1Id, salesforceId, createdAt) {
  return {
    source: 'salesforce',
    sourceEntity: 'account',
    sourceEntityId: salesforceId,
    target: 'v1',
    targetEntity: 'university',
    targetEntityId: v1Id,
    createdAt,
  }
}

function generateSubscriptionToV1Mapping(subscriptionId, v1Id) {
  return {
    source: 'v1',
    sourceEntity: 'university',
    sourceEntityId: v1Id,
    target: 'v2',
    targetEntity: 'subscription',
    targetEntityId: subscriptionId,
    createdAt: new Date().toISOString(),
  }
}

function generateSubscriptionToSalesforceMapping(subscriptionId, salesforceId) {
  return {
    source: 'salesforce',
    sourceEntity: 'account',
    sourceEntityId: salesforceId,
    target: 'v2',
    targetEntity: 'subscription',
    targetEntityId: subscriptionId,
    createdAt: new Date().toISOString(),
  }
}

/**
 *
 * @param {string} subscriptionId
 * @param {string} recurlyId
 * @param {string} [createdAt] - Should be an ISO date
 * @return {AccountMapping}
 */
function generateSubscriptionToRecurlyMapping(
  subscriptionId,
  recurlyId,
  createdAt = new Date().toISOString()
) {
  return {
    source: 'recurly',
    sourceEntity: 'subscription',
    sourceEntityId: recurlyId,
    target: 'v2',
    targetEntity: 'subscription',
    targetEntityId: subscriptionId,
    createdAt,
  }
}

module.exports = {
  extractAccountMappingsFromSubscription,
  generateV1Mapping,
  generateSubscriptionToRecurlyMapping,
}
