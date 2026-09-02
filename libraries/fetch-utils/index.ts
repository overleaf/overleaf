import { Readable, Duplex } from 'node:stream'
import OError from '@overleaf/o-error'
import fetch, { Headers } from 'node-fetch'
import type { RequestInit, Response } from 'node-fetch'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

let logger: { warn: (...args: any[]) => void } | undefined

type BasicAuthOptions = {
  user: string
  password: string
}

type FetchRequestOptions = RequestInit & {
  json?: unknown
  basicAuth?: BasicAuthOptions
}

type FetchHeaders = NonNullable<RequestInit['headers']>

type ParsedFetchOptions = Omit<
  FetchRequestOptions,
  'json' | 'signal' | 'basicAuth' | 'headers'
> & {
  headers: Headers
  signal?: AbortSignal
}

function setLogger(loggerInstance: { warn: (...args: any[]) => void }) {
  logger = loggerInstance
}

/**
 * Make a request and return the parsed JSON response.
 *
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchJson(url: string | URL, opts: FetchRequestOptions = {}) {
  const { json } = await fetchJsonWithResponse(url, opts)
  return json
}

async function fetchJsonWithResponse(
  url: string | URL,
  opts: FetchRequestOptions = {}
) {
  const { fetchOpts, detachSignal } = parseOpts(opts, url)
  if (!fetchOpts.headers.has('Accept')) {
    fetchOpts.headers.set('Accept', 'application/json')
  }

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
async function fetchStream(url: string | URL, opts: FetchRequestOptions = {}) {
  const { stream } = await fetchStreamWithResponse(url, opts)
  return stream
}

async function fetchStreamWithResponse(
  url: string | URL,
  opts: FetchRequestOptions = {}
) {
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
async function fetchNothing(url: string | URL, opts: FetchRequestOptions = {}) {
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
async function fetchRedirect(
  url: string | URL,
  opts: FetchRequestOptions = {}
) {
  const { location } = await fetchRedirectWithResponse(url, opts)
  return location
}

/**
 * Make a request and extract the redirect from the response.
 *
 * @throws {RequestFailedError} if the response has a non redirect status code or missing Location header
 */
async function fetchRedirectWithResponse(
  url: string | URL,
  opts: FetchRequestOptions = {}
) {
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
async function fetchString(url: string | URL, opts: FetchRequestOptions = {}) {
  const { body } = await fetchStringWithResponse(url, opts)
  return body
}

async function fetchStringWithResponse(
  url: string | URL,
  opts: FetchRequestOptions = {}
) {
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
    opts: Pick<FetchRequestOptions, 'method'>,
    response: Response,
    body: string | null
  ) {
    super('request failed', {
      url,
      method: opts.method ?? 'GET',
      status: response.status,
      ...([400, 409, 413, 422].includes(response.status) ? { body } : {}),
    })

    this.response = response
    if (body != null) {
      this.body = body
    }
  }
}

function setupDefaultAgent(fetchOpts: ParsedFetchOptions) {
  // Provide a function to get the agent for each request as there may be
  // multiple requests with different protocols due to redirects.
  fetchOpts.agent = (url: URL) =>
    url.protocol === 'https:' ? httpsAgent : httpAgent
}

/**
 * Normalise the headers option into a Headers instance, which is what
 * node-fetch builds from it anyway.
 *
 * Headers with an unset value are dropped: header values are stringified, so
 * they would otherwise be sent as the literal string `undefined`.
 */
function parseHeaders(headers: FetchHeaders): Headers {
  // A Headers instance can't hold unset values. Pass it through rather than
  // iterate it, which would collapse repeated headers into a single
  // comma-separated value.
  if (headers instanceof Headers) {
    return headers
  }
  // Not in the TS type, but node-fetch accepts any iterable of entries, such as
  // a Map or a global Headers instance. Those expose no own enumerable
  // properties, so they have to be iterated rather than passed to
  // Object.entries().
  const entries: Iterable<[string, unknown]> =
    Symbol.iterator in headers
      ? (headers as Iterable<[string, unknown]>)
      : Object.entries(headers)
  const parsedHeaders = new Headers()
  for (const [name, value] of entries) {
    if (value != null) {
      parsedHeaders.append(name, String(value))
    }
  }
  return parsedHeaders
}

function parseOpts(opts: FetchRequestOptions, url: string | URL) {
  const { json, signal, basicAuth, headers, ...rawFetchOpts } = opts
  const fetchOpts: ParsedFetchOptions = {
    ...rawFetchOpts,
    headers: parseHeaders(headers ?? {}),
  }
  if (json) {
    setupJsonBody(fetchOpts, json)
  }
  if (basicAuth) {
    setupBasicAuth(fetchOpts, basicAuth)
  }
  if (!fetchOpts.agent) {
    setupDefaultAgent(fetchOpts)
  }

  const abortController = new AbortController()
  fetchOpts.signal = abortController.signal
  let detachSignal: () => void
  if (signal) {
    detachSignal = abortOnSignal(abortController, signal)
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
            method: fetchOpts.method ?? 'GET',
            overTimeoutMs:
              Number(process.hrtime.bigint() - overTimeoutStart) / 1e6,
            stack,
          },
          'Fetch request did not complete within 120 seconds'
        )
      }
    }
  }
  if (fetchOpts.body instanceof Readable) {
    abortOnDestroyedRequest(abortController, fetchOpts.body)
  }
  return { fetchOpts, abortController, detachSignal }
}

function setupJsonBody(fetchOpts: ParsedFetchOptions, json: unknown) {
  fetchOpts.body = JSON.stringify(json)
  fetchOpts.headers.set('Content-Type', 'application/json')
}

function setupBasicAuth(
  fetchOpts: ParsedFetchOptions,
  basicAuth: BasicAuthOptions
) {
  fetchOpts.headers.set(
    'Authorization',
    'Basic ' +
      Buffer.from(`${basicAuth.user}:${basicAuth.password}`).toString('base64')
  )
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
  stream: Readable
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
  fetchOpts: ParsedFetchOptions,
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
    const requestBodyStream = fetchOpts.body
    response.body.on('close', () => {
      if (!requestBodyStream.readableEnded) {
        requestBodyStream.destroy()
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

function tryToCreateConnection(
  createConnection: (options: any) => Duplex,
  options: any,
  callback: (err: any, socket: any) => void
) {
  let socket: Duplex
  try {
    socket = createConnection(options)
  } catch (err) {
    callback(err, null)
    return
  }
  const timer = setTimeout(() => {
    socket.destroy(new ConnectTimeoutError(options))
  }, options.connectTimeout)
  const onConnect = () => {
    clearTimeout(timer)
    socket.off('error', onError)
    callback(null, socket)
  }
  const onError = (err: any) => {
    clearTimeout(timer)
    socket.off('connect', onConnect)
    callback(err, null)
  }
  socket.once('connect', onConnect)
  socket.once('error', onError)
}

function withTimeout(
  createConnection: (options: any) => Duplex,
  options: any,
  callback: (err: any, socket: any) => void
) {
  const attempt = (remainingAttempts: number) => {
    remainingAttempts--
    tryToCreateConnection(createConnection, options, (err, socket) => {
      if (err && remainingAttempts > 0) {
        setTimeout(() => {
          attempt(remainingAttempts)
        }, options.connectRetryInterval ?? 100)
        return
      }
      callback(err, socket)
    })
  }
  attempt(3)
}

class CustomHttpAgent extends http.Agent {
  constructor(options: any) {
    if (!(options.connectTimeout > 0)) {
      throw new Error(
        'CustomHttpAgent must be called with positive connectTimeout'
      )
    }
    super(options)
  }
  createConnection(options: any, callback: any) {
    withTimeout(net.createConnection, options, callback)
    return undefined
  }
}

class CustomHttpsAgent extends https.Agent {
  constructor(options: any) {
    if (!(options.connectTimeout > 0)) {
      throw new Error(
        'CustomHttpsAgent must be called with positive connectTimeout'
      )
    }
    super(options)
  }
  createConnection(options: any, callback: any) {
    withTimeout(tls.connect, options, callback)
    return undefined
  }
}

const MAX_CONNECT_TIME = 1000
const httpAgent = new CustomHttpAgent({ connectTimeout: MAX_CONNECT_TIME })
const httpsAgent = new CustomHttpsAgent({ connectTimeout: MAX_CONNECT_TIME })

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
