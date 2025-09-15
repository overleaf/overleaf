// ts-check
/**
 * Builds a group subscription's `providerId` to be used to identify SAML identifiers
 * belonging to this group.
 * @param {string | import('mongodb').ObjectId} subscriptionId
 * @returns {string}
 */
function getProviderId(subscriptionId) {
  return `ol-group-subscription-id:${subscriptionId.toString()}`
}

export default {
  getProviderId,
}
