import { expect } from 'chai'
import dns from 'node:dns'
import http from 'node:http'
import { once } from 'node:events'
import events from 'node:events'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { describe, beforeAll, beforeEach, afterAll, it } from 'vitest'
import { AbortError, FetchError, Headers } from 'node-fetch'
import selfsigned from 'selfsigned'
import { TestServer } from './helpers/TestServer.js'
import {
  fetchJson,
  fetchStream,
  fetchNothing,
  fetchRedirect,
  fetchString,
  RequestFailedError,
  CustomHttpAgent,
  CustomHttpsAgent,
} from '../../index.ts'

const HTTP_PORT = 30001
const HTTPS_PORT = 30002

const url = pathname => `http://example.com:${HTTP_PORT}${pathname}`
const httpsUrl = pathname => `https://example.com:${HTTPS_PORT}${pathname}`

const _originalLookup = dns.lookup
// Custom DNS resolver function
dns.lookup = (hostname, options, callback) => {
  if (hostname === 'example.com') {
    // If the hostname is our test case, return the ip address for the test server
    if (options?.all) {
      callback(null, [{ address: '127.0.0.1', family: 4 }])
    } else {
      callback(null, '127.0.0.1', 4)
    }
  } else {
    // Otherwise, use the default lookup
    _originalLookup(hostname, options, callback)
  }
}

describe('fetch-utils', function () {
  let server
  let PUBLIC_CERT

  beforeAll(async function () {
    server = new TestServer()
    const attrs = [{ name: 'commonName', value: 'example.com' }]
    const pems = await selfsigned.generate(attrs, { days: 365, keySize: 2048 })

    const PRIVATE_KEY = pems.private
    PUBLIC_CERT = pems.cert
    await server.start(HTTP_PORT, HTTPS_PORT, {
      key: PRIVATE_KEY,
      cert: PUBLIC_CERT,
    })
  })

  beforeEach(function () {
    server.lastReq = undefined
  })

  afterAll(async function () {
    await server.stop()
  })

  describe('fetchJson', function () {
    it('parses a JSON response', async function () {
      const json = await fetchJson(url('/json/hello'))
      expect(json).to.deep.equal({ msg: 'hello' })
    })

    it('parses JSON in the request', async function () {
      const json = await fetchJson(url('/json/add'), {
        method: 'POST',
        json: { a: 2, b: 3 },
      })
      expect(json).to.deep.equal({ sum: 5 })
    })

    it('accepts stringified JSON as body', async function () {
      const json = await fetchJson(url('/json/add'), {
        method: 'POST',
        body: JSON.stringify({ a: 2, b: 3 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(json).to.deep.equal({ sum: 5 })
    })

    it('throws a FetchError when the payload is not JSON', async function () {
      await expect(fetchJson(url('/hello'))).to.be.rejectedWith(FetchError)
    })

    it('aborts the request if JSON parsing fails', async function () {
      await expect(fetchJson(url('/large'))).to.be.rejectedWith(FetchError)
      await expectRequestAborted(server.lastReq)
    })

    it('handles errors when the payload is JSON', async function () {
      await expect(fetchJson(url('/json/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(server.lastReq)
    })

    it('handles errors when the payload is not JSON', async function () {
      await expect(fetchJson(url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(server.lastReq)
    })

    it('supports abort signals', async function () {
      await expect(
        abortOnceReceived(signal => fetchJson(url('/hang'), { signal }), server)
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(server.lastReq)
    })

    it('supports basic auth', async function () {
      const json = await fetchJson(url('/json/basic-auth'), {
        basicAuth: { user: 'user', password: 'pass' },
      })
      expect(json).to.deep.equal({ key: 'verysecret' })
    })

    it('sets an Authorization header for basic auth', async function () {
      await fetchJson(url('/json/basic-auth'), {
        basicAuth: { user: 'user', password: 'pass' },
      })
      expect(server.lastReq.headers.authorization).to.equal(
        'Basic ' + Buffer.from('user:pass').toString('base64')
      )
    })

    it("destroys the request body if it doesn't get consumed", async function () {
      const stream = Readable.from(infiniteIterator())
      await fetchJson(url('/json/ignore-request'), {
        method: 'POST',
        body: stream,
      })
      expect(stream.destroyed).to.be.true
    })

    describe('headers', function () {
      it('sets an Accept header of application/json by default', async function () {
        await fetchJson(url('/json/hello'))
        expect(server.lastReq.headers.accept).to.equal('application/json')
      })

      it('passes provided headers', async function () {
        await fetchJson(url('/json/hello'), {
          headers: { 'x-some-value': 'value' },
        })
        expect(server.lastReq.headers['x-some-value']).to.equal('value')
      })

      it('respects an explicitly provided Accept header', async function () {
        await fetchJson(url('/json/hello'), {
          headers: { Accept: 'application/vnd.api+json' },
        })
        expect(server.lastReq.headers.accept).to.equal(
          'application/vnd.api+json'
        )
      })

      it('sets the default Accept header when headers are provided as a Headers instance', async function () {
        await fetchJson(url('/json/hello'), {
          headers: new Headers({ 'X-Foo': 'bar' }),
        })
        expect(server.lastReq.headers.accept).to.equal('application/json')
        expect(server.lastReq.headers['x-foo']).to.equal('bar')
      })

      it('sets the default Accept header when headers are provided as an array of tuples', async function () {
        await fetchJson(url('/json/hello'), {
          headers: [['X-Foo', 'bar']],
        })
        expect(server.lastReq.headers.accept).to.equal('application/json')
        expect(server.lastReq.headers['x-foo']).to.equal('bar')
      })

      it('treats an unset Accept header as absent and applies the default', async function () {
        await fetchJson(url('/json/hello'), {
          headers: { Accept: undefined },
        })
        expect(server.lastReq.headers.accept).to.equal('application/json')
      })

      it('omits headers with unset values rather than sending "undefined"', async function () {
        await fetchJson(url('/json/hello'), {
          headers: { 'x-some-value': undefined, 'x-other-value': null },
        })
        expect(server.lastReq.headers).to.not.have.property('x-some-value')
        expect(server.lastReq.headers).to.not.have.property('x-other-value')
      })

      it('omits headers with unset values provided as an array of tuples', async function () {
        await fetchJson(url('/json/hello'), {
          headers: [
            ['X-Foo', 'bar'],
            ['X-Unset', undefined],
          ],
        })
        expect(server.lastReq.headers['x-foo']).to.equal('bar')
        expect(server.lastReq.headers).to.not.have.property('x-unset')
      })

      it('omits headers with unset values provided as a Map', async function () {
        await fetchJson(url('/json/hello'), {
          headers: new Map([
            ['X-Foo', 'bar'],
            ['X-Unset', undefined],
          ]),
        })
        expect(server.lastReq.headers['x-foo']).to.equal('bar')
        expect(server.lastReq.headers).to.not.have.property('x-unset')
      })

      it('keeps headers provided as a global Headers instance', async function () {
        // Not an instance of node-fetch's Headers: it exposes no own
        // enumerable properties to iterate over.
        await fetchJson(url('/json/hello'), {
          headers: new globalThis.Headers({ 'X-Foo': 'bar' }),
        })
        expect(server.lastReq.headers['x-foo']).to.equal('bar')
      })

      it('sets a Content-Type header of application/json when sending a JSON body', async function () {
        await fetchJson(url('/json/add'), {
          method: 'POST',
          json: { a: 2, b: 3 },
        })
        expect(server.lastReq.headers['content-type']).to.equal(
          'application/json'
        )
      })
    })
  })

  describe('fetchStream', function () {
    it('returns a stream', async function () {
      const stream = await fetchStream(url('/large'))
      const text = await streamToString(stream)
      expect(text).to.equal(server.largePayload)
    })

    it('aborts the request when the stream is destroyed', async function () {
      const stream = await fetchStream(url('/large'))
      stream.destroy()
      await expectRequestAborted(server.lastReq)
    })

    it('aborts the request when the request body is destroyed before transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      const promise = fetchStream(url('/hang'), {
        method: 'POST',
        body: stream,
      })
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      await wait(80)
      expect(server.lastReq).to.be.undefined
    })

    it('aborts the request when the request body is destroyed during transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      // Note: this test won't work on `/hang`
      const promise = fetchStream(url('/sink'), {
        method: 'POST',
        body: stream,
      })
      await once(server.events, 'request-received')
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      await expectRequestAborted(server.lastReq)
    })

    it('handles errors', async function () {
      await expect(fetchStream(url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(server.lastReq)
    })

    it('supports abort signals', async function () {
      await expect(
        abortOnceReceived(
          signal => fetchStream(url('/hang'), { signal }),
          server
        )
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(server.lastReq)
    })

    it('destroys the request body when an error occurs', async function () {
      const stream = Readable.from(infiniteIterator())
      await expect(
        abortOnceReceived(
          signal =>
            fetchStream(url('/hang'), {
              method: 'POST',
              body: stream,
              signal,
            }),
          server
        )
      ).to.be.rejectedWith(AbortError)
      expect(stream.destroyed).to.be.true
    })

    it('detaches from signal on success', async function () {
      const signal = AbortSignal.timeout(10_000)
      for (let i = 0; i < 20; i++) {
        const s = await fetchStream(url('/hello'), { signal })
        expect(events.getEventListeners(signal, 'abort')).to.have.length(1)
        await pipeline(s, fs.createWriteStream('/dev/null'))
        expect(events.getEventListeners(signal, 'abort')).to.have.length(0)
      }
    })

    it('detaches from signal on error', async function () {
      const signal = AbortSignal.timeout(10_000)
      for (let i = 0; i < 20; i++) {
        try {
          await fetchStream(url('/500'), { signal })
        } catch (err) {
          if (err instanceof RequestFailedError && err.response.status === 500)
            continue
          throw err
        } finally {
          expect(events.getEventListeners(signal, 'abort')).to.have.length(0)
        }
      }
    })
  })

  describe('fetchNothing', function () {
    it('closes the connection', async function () {
      await fetchNothing(url('/large'))
      await expectRequestAborted(server.lastReq)
    })

    it('aborts the request when the request body is destroyed before transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      const promise = fetchNothing(url('/hang'), {
        method: 'POST',
        body: stream,
      })
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      expect(server.lastReq).to.be.undefined
    })

    it('aborts the request when the request body is destroyed during transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      // Note: this test won't work on `/hang`
      const promise = fetchNothing(url('/sink'), {
        method: 'POST',
        body: stream,
      })
      await once(server.events, 'request-received')
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      await wait(80)
      await expectRequestAborted(server.lastReq)
    })

    it("doesn't abort the request if the request body ends normally", async function () {
      const stream = Readable.from('hello there')
      await fetchNothing(url('/sink'), { method: 'POST', body: stream })
    })

    it('handles errors', async function () {
      await expect(fetchNothing(url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(server.lastReq)
    })

    it('supports abort signals', async function () {
      await expect(
        abortOnceReceived(
          signal => fetchNothing(url('/hang'), { signal }),
          server
        )
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(server.lastReq)
    })

    it('destroys the request body when an error occurs', async function () {
      const stream = Readable.from(infiniteIterator())
      await expect(
        abortOnceReceived(
          signal =>
            fetchNothing(url('/hang'), {
              method: 'POST',
              body: stream,
              signal,
            }),
          server
        )
      ).to.be.rejectedWith(AbortError)
      expect(stream.destroyed).to.be.true
    })
  })

  describe('RequestFailedError', function () {
    it('includes the response body in OError.info for a 400', async function () {
      const err = await getRejection(fetchNothing(url('/400')))
      expect(err.info).to.have.property('body', 'boom-400')
    })

    it('includes the response body in OError.info for a 409', async function () {
      const err = await getRejection(fetchNothing(url('/409')))
      expect(err.info).to.have.property('body', 'boom-409')
    })

    it('includes the response body in OError.info for a 413', async function () {
      const err = await getRejection(fetchNothing(url('/413')))
      expect(err.info).to.have.property('body', 'boom-413')
    })

    it('includes the response body in OError.info for a 422', async function () {
      const err = await getRejection(fetchNothing(url('/422')))
      expect(err.info).to.have.property('body', 'boom-422')
    })

    it('omits the response body from OError.info for a 500', async function () {
      const err = await getRejection(fetchNothing(url('/500')))
      expect(err.body).to.equal('Internal Server Error')
      expect(err.info).to.not.have.property('body')
    })
  })

  describe('fetchString', function () {
    it('returns a string', async function () {
      const body = await fetchString(url('/hello'))
      expect(body).to.equal('hello')
    })

    it('handles errors', async function () {
      await expect(fetchString(url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(server.lastReq)
    })
  })

  describe('fetchRedirect', function () {
    it('returns the immediate redirect', async function () {
      const body = await fetchRedirect(url('/redirect/1'))
      expect(body).to.equal(url('/redirect/2'))
    })

    it('rejects status 200', async function () {
      await expect(fetchRedirect(url('/hello'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(server.lastReq)
    })

    it('rejects empty redirect', async function () {
      await expect(fetchRedirect(url('/redirect/empty-location')))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.property('cause')
        .and.to.have.property('message')
        .to.equal('missing Location response header on 3xx response')
      await expectRequestAborted(server.lastReq)
    })

    it('handles errors', async function () {
      await expect(fetchRedirect(url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(server.lastReq)
    })
  })

  describe('CustomHttpAgent', function () {
    it('makes an http request successfully', async function () {
      const agent = new CustomHttpAgent({ connectTimeout: 100 })
      const body = await fetchString(url('/hello'), { agent })
      expect(body).to.equal('hello')
    })

    it('times out when accessing a non-routable address', async function () {
      const agent = new CustomHttpAgent({ connectTimeout: 10 })
      await expect(fetchString('http://10.255.255.255/', { agent }))
        .to.be.rejectedWith(FetchError)
        .and.eventually.have.property('message')
        .and.to.equal(
          'request to http://10.255.255.255/ failed, reason: connect timeout'
        )
    })

    it('retries after a delay', { timeout: 5_000 }, async function () {
      // The test should finish after 1.5s.
      // t   0ms: first connect fails with ECONNREFUSED
      // t 500ms: listen on port
      // t1000ms: retry to connect again, works
      // t1500ms: respond to request
      const agent = new CustomHttpAgent({
        connectTimeout: 100,
        connectRetryInterval: 1_000,
      })
      const server = http.createServer((req, res) => {
        setTimeout(() => {
          res.write('hello')
          res.end()
          server.close()
        }, 500)
      })
      // Grab a dynamic port, then close again so that the first connect
      // attempt is refused before the server starts listening for real.
      await once(server.listen(0), 'listening')
      const { port } = server.address()
      await new Promise(resolve => server.close(resolve))
      const t0 = performance.now()
      setTimeout(() => {
        server.listen(port)
      }, 500)
      const body = await fetchString(`http://127.0.0.1:${port}`, { agent })
      expect(body).to.equal('hello')
      const t1 = performance.now()
      expect(t1 - t0).to.be.at.least(1_500)
    })

    it('does not open a stray connection when the socket errors after connect', async function () {
      const agent = new CustomHttpAgent({
        connectTimeout: 100,
        connectRetryInterval: 10,
      })
      const connections = []
      const server = http.createServer(req => {
        // Reset the established connection before responding. Doing this in
        // the request handler guarantees the client finished the connect
        // phase, so the ECONNRESET arrives after 'connect' has fired.
        req.socket.resetAndDestroy()
      })
      server.on('connection', socket => connections.push(socket))
      await once(server.listen(0), 'listening')
      const { port } = server.address()
      try {
        await expect(
          fetchString(`http://127.0.0.1:${port}/`, { agent })
        ).to.be.rejectedWith(FetchError)
        // Leave time for a buggy connect retry to open a stray connection.
        await wait(200)
        expect(connections).to.have.length(1)
      } finally {
        for (const socket of connections) socket.destroy()
        server.close()
      }
    })
  })

  describe('CustomHttpsAgent', function () {
    it('makes an https request successfully', async function () {
      const agent = new CustomHttpsAgent({
        connectTimeout: 100,
        ca: PUBLIC_CERT,
      })
      const body = await fetchString(httpsUrl('/hello'), { agent })
      expect(body).to.equal('hello')
    })

    it('rejects an untrusted server', async function () {
      const agent = new CustomHttpsAgent({
        connectTimeout: 100,
      })
      await expect(fetchString(httpsUrl('/hello'), { agent }))
        .to.be.rejectedWith(FetchError)
        .and.eventually.have.property('code')
        .and.to.equal('DEPTH_ZERO_SELF_SIGNED_CERT')
    })

    it('times out when accessing a non-routable address', async function () {
      const agent = new CustomHttpsAgent({ connectTimeout: 10 })
      await expect(fetchString('https://10.255.255.255/', { agent }))
        .to.be.rejectedWith(FetchError)
        .and.eventually.have.property('message')
        .and.to.equal(
          'request to https://10.255.255.255/ failed, reason: connect timeout'
        )
    })
  })
})

async function streamToString(stream) {
  let s = ''
  for await (const chunk of stream) {
    s += chunk
  }
  return s
}

async function* infiniteIterator() {
  let i = 1
  while (true) {
    yield `chunk ${i++}\n`
  }
}

/**
 * @param {(signal: AbortSignal) => Promise<any>} func
 * @param {TestServer} server
 */
async function abortOnceReceived(func, server) {
  const controller = new AbortController()
  const promise = func(controller.signal)
  expect(events.getEventListeners(controller.signal, 'abort')).to.have.length(1)
  await once(server.events, 'request-received')
  controller.abort()
  try {
    return await promise
  } finally {
    expect(events.getEventListeners(controller.signal, 'abort')).to.have.length(
      0
    )
  }
}

async function expectRequestAborted(req) {
  if (!req.destroyed) {
    try {
      await once(req, 'close')
    } catch (err) {
      // `once` throws if req emits an 'error' event.
      // We ignore `Error: aborted` when the request is aborted.
      if (err.message !== 'aborted') {
        throw err
      }
    }
  }
  expect(req.destroyed).to.be.true
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function getRejection(promise) {
  try {
    await promise
  } catch (err) {
    return err
  }
  expect.fail('expected promise to reject')
}
