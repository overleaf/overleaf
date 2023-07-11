const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const { fetchJson } = require('@overleaf/fetch-utils')

async function getQueues(userId) {
  try {
    return await fetchJson(`${Settings.apis.tpdsworker.url}/queues/${userId}`)
  } catch (err) {
    throw OError.tag(err, 'failed to query TPDS queues for user', { userId })
  }
}

module.exports = {
  promises: {
    getQueues,
  },
}
