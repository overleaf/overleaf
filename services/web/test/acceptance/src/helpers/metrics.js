const { callbackify } = require('util')
const request = require('./request')

async function getMetric(matcher) {
  const { body } = await request.promises.request('/metrics')
  const found = body.split('\n').find(matcher)
  if (!found) return 0
  return parseInt(found.split(' ')[1], 0)
}

module.exports = {
  getMetric: callbackify(getMetric),
  promises: {
    getMetric,
  },
}
