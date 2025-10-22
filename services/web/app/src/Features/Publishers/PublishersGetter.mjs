const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const { fetchJson } = require('@overleaf/fetch-utils')
const { callbackify } = require('@overleaf/promise-utils')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const UserMembershipEntityConfigs = require('../UserMembership/UserMembershipEntityConfigs')

async function getManagedPublishers(userId) {
  return await UserMembershipsHandler.promises.getEntitiesByUser(
    UserMembershipEntityConfigs.publisher,
    userId
  )
}

async function fetchV1Data(publisher) {
  const url = `${Settings.apis.v1.url}/api/v2/brands/${publisher.slug}`
  try {
    const data = await fetchJson(url, {
      basicAuth: {
        user: Settings.apis.v1.user,
        password: Settings.apis.v1.pass,
      },
      signal: AbortSignal.timeout(Settings.apis.v1.timeout),
    })

    publisher.name = data?.name
    publisher.partner = data?.partner
  } catch (error) {
    logger.err(
      { model: 'Publisher', slug: publisher.slug, error },
      '[fetchV1DataError]'
    )
  }
}

module.exports = {
  getManagedPublishers: callbackify(getManagedPublishers),
  promises: {
    getManagedPublishers,
    fetchV1Data,
  },
}
