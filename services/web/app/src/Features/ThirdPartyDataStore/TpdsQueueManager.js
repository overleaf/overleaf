const Settings = require('settings-sharelatex')
const request = require('request-promise-native')

async function getQueues(userId) {
  return request({
    uri: `${Settings.apis.tpdsworker.url}/queues/${userId}`,
    json: true
  })
}

module.exports = {
  promises: {
    getQueues
  }
}
