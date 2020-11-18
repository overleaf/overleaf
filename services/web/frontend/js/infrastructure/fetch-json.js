// fetch wrapper to make simple JSON requests:
// - send the CSRF token in the request
// - set the JSON content-type in the request headers
// - throw errors on non-ok response
// - parse JSON response body, unless response is empty

export function getJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'GET' })
}

export function postJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'POST' })
}

export function deleteJSON(path, options) {
  return fetchJSON(path, { ...options, method: 'DELETE' })
}

export default function fetchJSON(
  path,
  { body = {}, headers = {}, method = 'GET', ...otherOptions }
) {
  const options = {
    ...otherOptions,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'X-Csrf-Token': window.csrfToken
    },
    method
  }

  if (method !== 'GET' && method !== 'HEAD') {
    options.body = JSON.stringify(body)
  }

  return fetch(path, options)
    .then(response => {
      if (!response.ok) throw new Error(response.status)

      // get the response as text first as .json() fails on empty responses.
      // (e.g. 204 responses)
      return response.text()
    })
    .then(responseText => {
      return responseText ? JSON.parse(responseText) : responseText
    })
}
