const OError = require('@overleaf/o-error')
const { assertHasStatusCode } = require('./requestHelper')
const CSRF_REGEX = /<meta name="ol-csrfToken" content="(.+?)">/

function _parseCsrf(body) {
  const match = CSRF_REGEX.exec(body)
  if (!match) {
    throw new Error('Cannot find csrfToken in HTML')
  }
  return match[1]
}

function getCsrfTokenForFactory({ request }) {
  return async function getCsrfTokenFor(endpoint) {
    try {
      const response = await request(endpoint)
      assertHasStatusCode(response, 200)
      return _parseCsrf(response.body)
    } catch (err) {
      throw new OError(`error fetching csrf token on ${endpoint}`, {}, err)
    }
  }
}

module.exports = {
  getCsrfTokenForFactory,
}
