const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const fetch = require('node-fetch')
const { callbackify } = require('../../util/promises')
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
  const authorization = `Basic ${Buffer.from(
    Settings.apis.v1.user + ':' + Settings.apis.v1.pass
  ).toString('base64')}`
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: authorization,
      },
      signal: AbortSignal.timeout(Settings.apis.v1.timeout),
    })
    const data = await response.json()

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
