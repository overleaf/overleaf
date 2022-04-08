// fetch wrapper to make simple JSON requests:
// - send the CSRF token in the request
// - set the JSON content-type in the request headers
// - throw errors on non-ok response
// - parse JSON response body, unless response is empty
import OError from '@overleaf/o-error'

/**
 * @typedef {Object} FetchOptions
 * @extends RequestInit
 * @property {Object} [body]
 * @property {Boolean} [swallowAbortError] Set to false for throwing AbortErrors.
 * @property {AbortSignal} [signal] Allows aborting a request via AbortController
 */

/**
 * @param {string} path
 * @param {FetchOptions} [options]
 */
export function getJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'GET' })
}

/**
 * @param {string} path
 * @param {FetchOptions} [options]
 */
export function postJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'POST' })
}

/**
 * @param {string} path
 * @param {FetchOptions} [options]
 */
export function putJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'PUT' })
}

/**
 * @param {string} path
 * @param {FetchOptions} [options]
 */
export function deleteJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'DELETE' })
}

/**
 * @param {number} statusCode
 * @returns {string}
 */
function getErrorMessageForStatusCode(statusCode) {
  switch (statusCode) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not Found'
    case 429:
      return 'Too Many Requests'
    case 500:
      return 'Internal Server Error'
    case 502:
      return 'Bad Gateway'
    case 503:
      return 'Service Unavailable'
    default:
      return `Unexpected Error: ${statusCode}`
  }
}

export class FetchError extends OError {
  /**
   * @param {string} message
   * @param {string} url
   * @param {FetchOptions} [options]
   * @param {Response} [response]
   * @param {Object} [data]
   */
  constructor(message, url, options, response, data) {
    // On HTTP2, the `statusText` property is not set,
    // so this `message` will be undefined. We need to
    // set a message based on the response `status`, so
    // our error UI rendering will work
    if (!message) {
      message = getErrorMessageForStatusCode(response.status)
    }
    super(message, { statusCode: response ? response.status : undefined })
    this.url = url
    this.options = options
    this.response = response
    this.data = data
  }

  /**
   * @returns {string}
   */
  getUserFacingMessage() {
    const statusCode = this.response?.status
    const defaultMessage = getErrorMessageForStatusCode(statusCode)
    const message = this.data?.message?.text || this.data?.message
    if (message && message !== defaultMessage) return message

    switch (statusCode) {
      case 400:
        return 'Invalid Request. Please correct the data and try again.'
      case 403:
        return 'Session error. Please check you have cookies enabled. If the problem persists, try clearing your cache and cookies.'
      case 429:
        return 'Too many attempts. Please wait for a while and try again.'
      default:
        return 'Something went wrong talking to the server :(. Please try again.'
    }
  }
}

/**
 * @param {string} path
 * @param {FetchOptions} [options]
 *
 * @return Promise<Object>
 */
function fetchJSON(
  path,
  {
    body = {},
    headers = {},
    method = 'GET',
    credentials = 'same-origin',
    swallowAbortError = true,
    ...otherOptions
  }
) {
  const options = {
    ...otherOptions,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'X-Csrf-Token': window.csrfToken,
      Accept: 'application/json',
    },
    credentials,
    method,
  }

  if (method !== 'GET' && method !== 'HEAD') {
    options.body = JSON.stringify(body)
  }

  // The returned Promise and the `.then(handleSuccess, handleError)` handlers are needed
  // to avoid calling `finally` in a Promise chain (and thus updating the component's state)
  // after a component has unmounted.
  // `resolve` will be called when the request succeeds, `reject` will be called when the request fails,
  // but nothing will be called if the request is cancelled via an AbortController.
  return new Promise((resolve, reject) => {
    fetch(path, options).then(
      response => {
        return parseResponseBody(response).then(
          data => {
            if (response.ok) {
              resolve(data)
            } else {
              // the response from the server was not 2xx
              reject(
                new FetchError(
                  response.statusText,
                  path,
                  options,
                  response,
                  data
                )
              )
            }
          },
          error => {
            // parsing the response body failed
            reject(
              new FetchError(
                'There was an error parsing the response body',
                path,
                options,
                response
              ).withCause(error)
            )
          }
        )
      },
      error => {
        // swallow the error if the fetch was cancelled (e.g. by cancelling an AbortController on component unmount)
        if (swallowAbortError && error.name === 'AbortError') {
          return
        }
        // the fetch failed
        reject(
          new FetchError(
            'There was an error fetching the JSON',
            path,
            options
          ).withCause(error)
        )
      }
    )
  })
}

/**
 * @param {Response} response
 * @returns {Promise<Object>}
 */
async function parseResponseBody(response) {
  const contentType = response.headers.get('Content-Type')

  if (/application\/json/.test(contentType)) {
    return response.json()
  }

  if (/text\/plain/.test(contentType)) {
    const message = await response.text()

    return { message }
  }

  if (/text\/html/.test(contentType)) {
    const message = await response.text()

    // only use HTML responses which don't start with `<`
    if (!/^\s*</.test(message)) {
      return { message }
    }
  }

  // response body ignored as content-type is either not set (e.g. 204
  // responses) or unsupported
  return {}
}
