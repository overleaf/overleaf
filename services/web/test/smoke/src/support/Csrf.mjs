import OError from '@overleaf/o-error'
import { assertHasStatusCode } from './requestHelper.mjs'
const CSRF_REGEX = /<meta name="ol-csrfToken" content="(.+?)">/

export function _parseCsrf(body) {
  const match = CSRF_REGEX.exec(body)
  if (!match) {
    throw new Error('Cannot find csrfToken in HTML')
  }
  return match[1]
}

export function getCsrfTokenForFactory({ request }) {
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
