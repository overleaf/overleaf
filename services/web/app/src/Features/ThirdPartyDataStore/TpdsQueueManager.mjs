import Settings from '@overleaf/settings'
import OError from '@overleaf/o-error'
import { fetchJson } from '@overleaf/fetch-utils'

async function getQueues(userId) {
  try {
    return await fetchJson(`${Settings.apis.tpdsworker.url}/queues/${userId}`)
  } catch (err) {
    throw OError.tag(err, 'failed to query TPDS queues for user', { userId })
  }
}

export default {
  promises: {
    getQueues,
  },
}
