export function extractAccountMappingsFromSubscription(
  subscription,
  updatedSubscription
) {
  const accountMappings = []
  if (
    updatedSubscription.salesforce_id ||
    updatedSubscription.salesforce_id === ''
  ) {
    if (subscription.salesforce_id !== updatedSubscription.salesforce_id) {
      accountMappings.push(
        generateSubscriptionToSalesforceMapping(
          subscription.id,
          updatedSubscription.salesforce_id
        )
      )
    }
  }
  if (updatedSubscription.v1_id || updatedSubscription.v1_id === '') {
    if (subscription.v1_id !== updatedSubscription.v1_id) {
      accountMappings.push(
        generateSubscriptionToV1Mapping(
          subscription.id,
          updatedSubscription.v1_id
        )
      )
    }
  }
  return accountMappings
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

export default {
  extractAccountMappingsFromSubscription,
}
