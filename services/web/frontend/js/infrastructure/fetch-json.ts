// fetch wrapper to make simple JSON requests:
// - send the CSRF token in the request
// - set the JSON content-type in the request headers
// - throw errors on non-ok response
// - parse JSON response body, unless response is empty
import OError from '@overleaf/o-error'
import getMeta from '@/utils/meta'

type FetchPath = string
// Custom config types are merged with `fetch`s RequestInit type
type FetchConfig = {
  swallowAbortError?: boolean
  body?: Record<string, unknown>
} & Omit<RequestInit, 'body'>

export function getJSON<T = any>(path: FetchPath, options?: FetchConfig) {
  return fetchJSON<T>(path, { ...options, method: 'GET' })
}

export function postJSON<T = any>(path: FetchPath, options?: FetchConfig) {
  return fetchJSON<T>(path, { ...options, method: 'POST' })
}

export function putJSON<T = any>(path: FetchPath, options?: FetchConfig) {
  return fetchJSON<T>(path, { ...options, method: 'PUT' })
}

export function deleteJSON<T = any>(path: FetchPath, options?: FetchConfig) {
  return fetchJSON<T>(path, { ...options, method: 'DELETE' })
}

function getErrorMessageForStatusCode(statusCode?: number) {
  if (!statusCode) {
    return 'Unknown Error'
  }

  const statusCodes: { readonly [K: number]: string } = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  }

  return statusCodes[statusCode] ?? `Unexpected Error: ${statusCode}`
}

export class FetchError extends OError {
  public url: string
  public options?: RequestInit
  public response?: Response
  public data?: any

  constructor(
    message: string,
    url: string,
    options?: RequestInit,
    response?: Response,
    data?: any
  ) {
    // On HTTP2, the `statusText` property is not set,
    // so this `message` will be undefined. We need to
    // set a message based on the response `status`, so
    // our error UI rendering will work
    if (!message) {
      message = getErrorMessageForStatusCode(response?.status)
    }

    super(message, { statusCode: response ? response.status : undefined })

    this.url = url
    this.options = options
    this.response = response
    this.data = data
  }

  getErrorMessageKey() {
    return this.data?.message?.key as string | undefined
  }

  getUserFacingMessage() {
    const statusCode = this.response?.status
    const defaultMessage = getErrorMessageForStatusCode(statusCode)
    const message = (this.data?.message?.text || this.data?.message) as
      | string
      | undefined
    if (message && message !== defaultMessage) return message

    const statusCodes: { readonly [K: number]: string } = {
      400: 'Invalid Request. Please correct the data and try again.',
      403: 'Session error. Please check you have cookies enabled. If the problem persists, try clearing your cache and cookies.',
      429: 'Too many attempts. Please wait for a while and try again.',
    }

    return statusCode && statusCodes[statusCode]
      ? statusCodes[statusCode]
      : 'Something went wrong. Please try again.'
  }
}

function fetchJSON<T>(
  path: FetchPath,
  {
    body,
    headers = {},
    method = 'GET',
    credentials = 'same-origin',
    swallowAbortError = true,
    ...otherOptions
  }: FetchConfig
) {
  const options: RequestInit = {
    ...otherOptions,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'X-Csrf-Token': getMeta('ol-csrfToken'),
      Accept: 'application/json',
    },
    credentials,
    method,
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  // The returned Promise and the `.then(handleSuccess, handleError)` handlers are needed
  // to avoid calling `finally` in a Promise chain (and thus updating the component's state)
  // after a component has unmounted.
  // `resolve` will be called when the request succeeds, `reject` will be called when the request fails,
  // but nothing will be called if the request is cancelled via an AbortController.
  return new Promise<T>((resolve, reject) => {
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
            // swallow the error if the fetch was cancelled (e.g. by cancelling an AbortController on component unmount)
            if (swallowAbortError && error.name === 'AbortError') {
              // the fetch request was aborted while reading/parsing the response body
              return
            }
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
          // the fetch request was aborted before a response was returned
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

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get('Content-Type')

  if (!contentType) {
    return {}
  }

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

export function getErrorMessageKey(error: Error | null) {
  if (!error) {
    return undefined
  }

  if (error instanceof FetchError) {
    return error.getErrorMessageKey()
  }

  return error.message
}

export function getUserFacingMessage(error: Error | null) {
  if (!error) {
    return undefined
  }

  if (error instanceof FetchError) {
    return error.getUserFacingMessage()
  }

  return error.message
}

export function isRateLimited(error?: Error | FetchError | any) {
  if (error && error instanceof FetchError) {
    return error.response?.status === 429
  }
  return false
}
