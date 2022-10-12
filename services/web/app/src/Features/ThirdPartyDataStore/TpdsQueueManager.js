const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const fetch = require('node-fetch')

async function getQueues(userId) {
  const response = await fetch(
    `${Settings.apis.tpdsworker.url}/queues/${userId}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  )
  if (!response.ok) {
    throw new OError('failed to query TPDS queues for user', { userId })
  }
  const body = await response.json()
  return body
}

module.exports = {
  promises: {
    getQueues,
  },
}
