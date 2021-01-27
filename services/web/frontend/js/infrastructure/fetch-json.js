// fetch wrapper to make simple JSON requests:
// - send the CSRF token in the request
// - set the JSON content-type in the request headers
// - throw errors on non-ok response
// - parse JSON response body, unless response is empty
const OError = require('@overleaf/o-error')

export function getJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'GET' })
}

export function postJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'POST' })
}

export function putJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'PUT' })
}

export function deleteJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'DELETE' })
}

function fetchJSON(
  path,
  {
    body = {},
    headers = {},
    method = 'GET',
    credentials = 'same-origin',
    ...otherOptions
  }
) {
  const options = {
    ...otherOptions,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'X-Csrf-Token': window.csrfToken,
      Accept: 'application/json'
    },
    credentials,
    method
  }

  if (method !== 'GET' && method !== 'HEAD') {
    options.body = JSON.stringify(body)
  }

  return fetch(path, options)
    .then(parseResponseBody)
    .then(({ responseBody, response }) => {
      if (!response.ok) {
        throw new OError(response.statusText, {
          statusCode: response.status,
          responseBody,
          response
        })
      }

      return responseBody
    })
}

function parseResponseBody(response) {
  const contentType = response.headers.get('Content-Type')
  if (/application\/json/.test(contentType)) {
    return response.json().then(json => {
      return { responseBody: json, response }
    })
  } else if (
    /text\/plain/.test(contentType) ||
    /text\/html/.test(contentType)
  ) {
    return response.text().then(text => {
      return { responseBody: { message: text }, response }
    })
  } else {
    // response body ignored as content-type is either not set (e.g. 204
    // responses) or unsupported
    return Promise.resolve({ responseBody: {}, response })
  }
}
