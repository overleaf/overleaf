import _ from 'lodash'
import { Readable } from 'node:stream'
import OError from '@overleaf/o-error'
import fetch from 'node-fetch'
import type { Response } from 'node-fetch'
import http from 'node:http'
import https from 'node:https'

let logger: { warn: (...args: any[]) => void } | undefined

function setLogger(loggerInstance: { warn: (...args: any[]) => void }) {
  logger = loggerInstance
}

/**
 * Make a request and return the parsed JSON response.
 *
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchJson(url: string | URL, opts: any = {}) {
  const { json } = await fetchJsonWithResponse(url, opts)
  return json
}

async function fetchJsonWithResponse(url: string | URL, opts: any = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts, url)
  fetchOpts.headers = fetchOpts.headers ?? {}
  fetchOpts.headers.Accept = fetchOpts.headers.Accept ?? 'application/json'

  const response = await performRequest(url, fetchOpts, detachSignal)
  if (!response.ok) {
    const body = await maybeGetResponseBody(response)
    throw new RequestFailedError(url, opts, response, body)
  }

  const json = await response.json()
  return { json, response }
}

/**
 * Make a request and return a stream.
 *
 * If the response body is destroyed, the request is aborted.
 *
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchStream(url: string | URL, opts: any = {}) {
  const { stream } = await fetchStreamWithResponse(url, opts)
  return stream
}

async function fetchStreamWithResponse(url: string | URL, opts: any = {}) {
  const { fetchOpts, abortController, detachSignal } = parseOpts(opts, url)
  const response = await performRequest(url, fetchOpts, detachSignal)

  if (!response.ok) {
    const body = await maybeGetResponseBody(response)
    throw new RequestFailedError(url, opts, response, body)
  }

  abortOnDestroyedResponse(abortController, response)

  const stream = response.body
  return { stream, response }
}

/**
 * Make a request and discard the response.
 *
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchNothing(url: string | URL, opts: any = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts, url)
  const response = await performRequest(url, fetchOpts, detachSignal)
  if (!response.ok) {
    const body = await maybeGetResponseBody(response)
    throw new RequestFailedError(url, opts, response, body)
  }
  await discardResponseBody(response)
  return response
}

/**
 * Make a request and extract the redirect from the response.
 *
 * @throws {RequestFailedError} if the response has a non redirect status code or missing Location header
 */
async function fetchRedirect(url: string | URL, opts: any = {}) {
  const { location } = await fetchRedirectWithResponse(url, opts)
  return location
}

/**
 * Make a request and extract the redirect from the response.
 *
 * @throws {RequestFailedError} if the response has a non redirect status code or missing Location header
 */
async function fetchRedirectWithResponse(url: string | URL, opts: any = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts, url)
  fetchOpts.redirect = 'manual'
  const response = await performRequest(url, fetchOpts, detachSignal)
  if (response.status < 300 || response.status >= 400) {
    const body = await maybeGetResponseBody(response)
    throw new RequestFailedError(url, opts, response, body)
  }
  const location = response.headers.get('Location')
  if (!location) {
    const body = await maybeGetResponseBody(response)
    throw new RequestFailedError(url, opts, response, body).withCause(
      new OError('missing Location response header on 3xx response', {
        headers: Object.fromEntries(response.headers.entries()),
      })
    )
  }
  await discardResponseBody(response)
  return { location, response }
}

/**
 * Make a request and return a string.
 *
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchString(url: string | URL, opts: any = {}) {
  const { body } = await fetchStringWithResponse(url, opts)
  return body
}

async function fetchStringWithResponse(url: string | URL, opts: any = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts, url)
  const response = await performRequest(url, fetchOpts, detachSignal)
  if (!response.ok) {
    const body = await maybeGetResponseBody(response)
    throw new RequestFailedError(url, opts, response, body)
  }
  const body = await response.text()
  return { body, response }
}

class RequestFailedError extends OError {
  response: Response
  body?: string

  constructor(
    url: string | URL,
    opts: any,
    response: Response,
    body: string | null
  ) {
    super('request failed', {
      url,
      method: opts.method ?? 'GET',
      status: response.status,
    })

    this.response = response
    if (body != null) {
      this.body = body
    }
  }
}

function parseOpts(opts: any, url: string | URL) {
  const fetchOpts = _.omit(opts, ['json', 'signal', 'basicAuth'])
  if (opts.json) {
    setupJsonBody(fetchOpts, opts.json)
  }
  if (opts.basicAuth) {
    setupBasicAuth(fetchOpts, opts.basicAuth)
  }

  const abortController = new AbortController()
  fetchOpts.signal = abortController.signal
  let detachSignal
  if (opts.signal) {
    detachSignal = abortOnSignal(abortController, opts.signal)
  } else {
    let overTimeoutStart: bigint | undefined
    const stack = new Error().stack
    const timeout = setTimeout(() => {
      overTimeoutStart = process.hrtime.bigint()
    }, 120000)
    detachSignal = () => {
      clearTimeout(timeout)
      if (overTimeoutStart && logger) {
        logger.warn(
          {
            url,
            method: opts.method ?? 'GET',
            overTimeoutMs:
              Number(process.hrtime.bigint() - overTimeoutStart) / 1e6,
            stack,
          },
          'Fetch request did not complete within 120 seconds'
        )
      }
    }
  }
  if (opts.body instanceof Readable) {
    abortOnDestroyedRequest(abortController, fetchOpts.body)
  }
  return { fetchOpts, abortController, detachSignal }
}

function setupJsonBody(fetchOpts: any, json: any) {
  fetchOpts.body = JSON.stringify(json)
  fetchOpts.headers = fetchOpts.headers ?? {}
  fetchOpts.headers['Content-Type'] = 'application/json'
}

function setupBasicAuth(fetchOpts: any, basicAuth: any) {
  fetchOpts.headers = fetchOpts.headers ?? {}
  fetchOpts.headers.Authorization =
    'Basic ' +
    Buffer.from(`${basicAuth.user}:${basicAuth.password}`).toString('base64')
}

function abortOnSignal(abortController: AbortController, signal: AbortSignal) {
  const listener = () => {
    abortController.abort(signal.reason)
  }
  if (signal.aborted) {
    abortController.abort(signal.reason)
  }
  signal.addEventListener('abort', listener)
  return () => {
    signal.removeEventListener('abort', listener)
  }
}

function abortOnDestroyedRequest(
  abortController: AbortController,
  stream: any
) {
  stream.on('close', () => {
    if (!stream.readableEnded) {
      abortController.abort()
    }
  })
}

function abortOnDestroyedResponse(
  abortController: AbortController,
  response: Response
) {
  response.body.on('close', () => {
    if (!response.bodyUsed) {
      abortController.abort()
    }
  })
}

async function performRequest(
  url: string | URL,
  fetchOpts: any,
  detachSignal: () => void
) {
  let response
  try {
    response = await fetch(url, fetchOpts)
  } catch (err: any) {
    detachSignal()
    if (fetchOpts.body instanceof Readable) {
      fetchOpts.body.destroy()
    }
    throw OError.tag(err, err.message, {
      url,
      method: fetchOpts.method ?? 'GET',
    })
  }
  response.body.on('close', detachSignal)
  if (fetchOpts.body instanceof Readable) {
    response.body.on('close', () => {
      if (!fetchOpts.body.readableEnded) {
        fetchOpts.body.destroy()
      }
    })
  }
  return response
}

async function discardResponseBody(response: Response) {
  // eslint-disable-next-line no-unused-vars
  for await (const chunk of response.body) {
    // discard the body
  }
}

async function maybeGetResponseBody(response: Response) {
  try {
    return await response.text()
  } catch (err) {
    return null
  }
}

// Define custom http and https agents with support for connect timeouts

class ConnectTimeoutError extends OError {
  constructor(options: any) {
    super('connect timeout', options)
  }
}

function withTimeout(createConnection: any, options: any, callback: any) {
  if (options.connectTimeout) {
    // Wrap createConnection in a timeout
    const timer = setTimeout(() => {
      socket.destroy(new ConnectTimeoutError(options))
    }, options.connectTimeout)
    const socket = createConnection(options, (err: any, stream: any) => {
      clearTimeout(timer)
      callback(err, stream)
    })
    return socket
  } else {
    // Fallback to default createConnection
    return createConnection(options, callback)
  }
}

class CustomHttpAgent extends http.Agent {
  createConnection(options: any, callback: any) {
    return withTimeout(super.createConnection.bind(this), options, callback)
  }
}
class CustomHttpsAgent extends https.Agent {
  createConnection(options: any, callback: any) {
    return withTimeout(super.createConnection.bind(this), options, callback)
  }
}

export {
  fetchJson,
  fetchJsonWithResponse,
  fetchStream,
  fetchStreamWithResponse,
  fetchNothing,
  fetchRedirect,
  fetchRedirectWithResponse,
  fetchString,
  fetchStringWithResponse,
  RequestFailedError,
  ConnectTimeoutError,
  CustomHttpAgent,
  CustomHttpsAgent,
  setLogger,
}
