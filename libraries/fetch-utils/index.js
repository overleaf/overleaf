const _ = require('lodash')
const { Readable } = require('node:stream')
const OError = require('@overleaf/o-error')
const fetch = require('node-fetch')
const http = require('node:http')
const https = require('node:https')

/**
 * @import { Response } from 'node-fetch'
 */

/**
 * Make a request and return the parsed JSON response.
 *
 * @param {string | URL} url - request URL
 * @param {any} [opts] - fetch options
 * @return {Promise<any>} the parsed JSON response
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchJson(url, opts = {}) {
  const { json } = await fetchJsonWithResponse(url, opts)
  return json
}

async function fetchJsonWithResponse(url, opts = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts)
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
 * @param {string | URL} url - request URL
 * @param {any} [opts] - fetch options
 * @return {Promise<Readable>}
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchStream(url, opts = {}) {
  const { stream } = await fetchStreamWithResponse(url, opts)
  return stream
}

async function fetchStreamWithResponse(url, opts = {}) {
  const { fetchOpts, abortController, detachSignal } = parseOpts(opts)
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
 * @param {string | URL} url - request URL
 * @param {any} [opts] - fetch options
 * @return {Promise<Response>}
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchNothing(url, opts = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts)
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
 * @param {string | URL} url - request URL
 * @param {any} [opts] - fetch options
 * @return {Promise<string>}
 * @throws {RequestFailedError} if the response has a non redirect status code or missing Location header
 */
async function fetchRedirect(url, opts = {}) {
  const { location } = await fetchRedirectWithResponse(url, opts)
  return location
}

/**
 * Make a request and extract the redirect from the response.
 *
 * @param {string | URL} url - request URL
 * @param {object} opts - fetch options
 * @return {Promise<{location: string, response: Response}>}
 * @throws {RequestFailedError} if the response has a non redirect status code or missing Location header
 */
async function fetchRedirectWithResponse(url, opts = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts)
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
 * @param {string | URL} url - request URL
 * @param {any} [opts] - fetch options
 * @return {Promise<string>}
 * @throws {RequestFailedError} if the response has a failure status code
 */
async function fetchString(url, opts = {}) {
  const { body } = await fetchStringWithResponse(url, opts)
  return body
}

async function fetchStringWithResponse(url, opts = {}) {
  const { fetchOpts, detachSignal } = parseOpts(opts)
  const response = await performRequest(url, fetchOpts, detachSignal)
  if (!response.ok) {
    const body = await maybeGetResponseBody(response)
    throw new RequestFailedError(url, opts, response, body)
  }
  const body = await response.text()
  return { body, response }
}

class RequestFailedError extends OError {
  constructor(url, opts, response, body) {
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

function parseOpts(opts) {
  const fetchOpts = _.omit(opts, ['json', 'signal', 'basicAuth'])
  if (opts.json) {
    setupJsonBody(fetchOpts, opts.json)
  }
  if (opts.basicAuth) {
    setupBasicAuth(fetchOpts, opts.basicAuth)
  }

  const abortController = new AbortController()
  fetchOpts.signal = abortController.signal
  let detachSignal = () => {}
  if (opts.signal) {
    detachSignal = abortOnSignal(abortController, opts.signal)
  }
  if (opts.body instanceof Readable) {
    abortOnDestroyedRequest(abortController, fetchOpts.body)
  }
  return { fetchOpts, abortController, detachSignal }
}

function setupJsonBody(fetchOpts, json) {
  fetchOpts.body = JSON.stringify(json)
  fetchOpts.headers = fetchOpts.headers ?? {}
  fetchOpts.headers['Content-Type'] = 'application/json'
}

function setupBasicAuth(fetchOpts, basicAuth) {
  fetchOpts.headers = fetchOpts.headers ?? {}
  fetchOpts.headers.Authorization =
    'Basic ' +
    Buffer.from(`${basicAuth.user}:${basicAuth.password}`).toString('base64')
}

function abortOnSignal(abortController, signal) {
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

function abortOnDestroyedRequest(abortController, stream) {
  stream.on('close', () => {
    if (!stream.readableEnded) {
      abortController.abort()
    }
  })
}

function abortOnDestroyedResponse(abortController, response) {
  response.body.on('close', () => {
    if (!response.bodyUsed) {
      abortController.abort()
    }
  })
}

async function performRequest(url, fetchOpts, detachSignal) {
  let response
  try {
    response = await fetch(url, fetchOpts)
  } catch (err) {
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

async function discardResponseBody(response) {
  // eslint-disable-next-line no-unused-vars
  for await (const chunk of response.body) {
    // discard the body
  }
}

/**
 * @param {Response} response
 */
async function maybeGetResponseBody(response) {
  try {
    return await response.text()
  } catch (err) {
    return null
  }
}

// Define custom http and https agents with support for connect timeouts

class ConnectTimeoutError extends OError {
  constructor(options) {
    super('connect timeout', options)
  }
}

function withTimeout(createConnection, options, callback) {
  if (options.connectTimeout) {
    // Wrap createConnection in a timeout
    const timer = setTimeout(() => {
      socket.destroy(new ConnectTimeoutError(options))
    }, options.connectTimeout)
    const socket = createConnection(options, (err, stream) => {
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
  createConnection(options, callback) {
    return withTimeout(super.createConnection.bind(this), options, callback)
  }
}
class CustomHttpsAgent extends https.Agent {
  createConnection(options, callback) {
    return withTimeout(super.createConnection.bind(this), options, callback)
  }
}

module.exports = {
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
}
