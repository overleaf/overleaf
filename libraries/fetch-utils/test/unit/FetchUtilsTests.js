const { expect } = require('chai')
const { FetchError, AbortError } = require('node-fetch')
const { Readable } = require('node:stream')
const { once } = require('node:events')
const { TestServer } = require('./helpers/TestServer')
const selfsigned = require('selfsigned')
const {
  fetchJson,
  fetchStream,
  fetchNothing,
  fetchRedirect,
  fetchString,
  RequestFailedError,
  CustomHttpAgent,
  CustomHttpsAgent,
} = require('../..')

const HTTP_PORT = 30001
const HTTPS_PORT = 30002

const attrs = [{ name: 'commonName', value: 'example.com' }]
const pems = selfsigned.generate(attrs, { days: 365 })

const PRIVATE_KEY = pems.private
const PUBLIC_CERT = pems.cert

const dns = require('node:dns')
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
  before(async function () {
    this.server = new TestServer()
    await this.server.start(HTTP_PORT, HTTPS_PORT, {
      key: PRIVATE_KEY,
      cert: PUBLIC_CERT,
    })
    this.url = path => `http://example.com:${HTTP_PORT}${path}`
    this.httpsUrl = path => `https://example.com:${HTTPS_PORT}${path}`
  })

  beforeEach(function () {
    this.server.lastReq = undefined
  })

  after(async function () {
    await this.server.stop()
  })

  describe('fetchJson', function () {
    it('parses a JSON response', async function () {
      const json = await fetchJson(this.url('/json/hello'))
      expect(json).to.deep.equal({ msg: 'hello' })
    })

    it('parses JSON in the request', async function () {
      const json = await fetchJson(this.url('/json/add'), {
        method: 'POST',
        json: { a: 2, b: 3 },
      })
      expect(json).to.deep.equal({ sum: 5 })
    })

    it('accepts stringified JSON as body', async function () {
      const json = await fetchJson(this.url('/json/add'), {
        method: 'POST',
        body: JSON.stringify({ a: 2, b: 3 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(json).to.deep.equal({ sum: 5 })
    })

    it('throws a FetchError when the payload is not JSON', async function () {
      await expect(fetchJson(this.url('/hello'))).to.be.rejectedWith(FetchError)
    })

    it('aborts the request if JSON parsing fails', async function () {
      await expect(fetchJson(this.url('/large'))).to.be.rejectedWith(FetchError)
      await expectRequestAborted(this.server.lastReq)
    })

    it('handles errors when the payload is JSON', async function () {
      await expect(fetchJson(this.url('/json/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(this.server.lastReq)
    })

    it('handles errors when the payload is not JSON', async function () {
      await expect(fetchJson(this.url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(this.server.lastReq)
    })

    it('supports abort signals', async function () {
      await expect(
        abortOnceReceived(
          signal => fetchJson(this.url('/hang'), { signal }),
          this.server
        )
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(this.server.lastReq)
    })

    it('supports basic auth', async function () {
      const json = await fetchJson(this.url('/json/basic-auth'), {
        basicAuth: { user: 'user', password: 'pass' },
      })
      expect(json).to.deep.equal({ key: 'verysecret' })
    })

    it("destroys the request body if it doesn't get consumed", async function () {
      const stream = Readable.from(infiniteIterator())
      await fetchJson(this.url('/json/ignore-request'), {
        method: 'POST',
        body: stream,
      })
      expect(stream.destroyed).to.be.true
    })
  })

  describe('fetchStream', function () {
    it('returns a stream', async function () {
      const stream = await fetchStream(this.url('/large'))
      const text = await streamToString(stream)
      expect(text).to.equal(this.server.largePayload)
    })

    it('aborts the request when the stream is destroyed', async function () {
      const stream = await fetchStream(this.url('/large'))
      stream.destroy()
      await expectRequestAborted(this.server.lastReq)
    })

    it('aborts the request when the request body is destroyed before transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      const promise = fetchStream(this.url('/hang'), {
        method: 'POST',
        body: stream,
      })
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      await wait(80)
      expect(this.server.lastReq).to.be.undefined
    })

    it('aborts the request when the request body is destroyed during transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      // Note: this test won't work on `/hang`
      const promise = fetchStream(this.url('/sink'), {
        method: 'POST',
        body: stream,
      })
      await once(this.server.events, 'request-received')
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      await expectRequestAborted(this.server.lastReq)
    })

    it('handles errors', async function () {
      await expect(fetchStream(this.url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(this.server.lastReq)
    })

    it('supports abort signals', async function () {
      await expect(
        abortOnceReceived(
          signal => fetchStream(this.url('/hang'), { signal }),
          this.server
        )
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(this.server.lastReq)
    })

    it('destroys the request body when an error occurs', async function () {
      const stream = Readable.from(infiniteIterator())
      await expect(
        abortOnceReceived(
          signal =>
            fetchStream(this.url('/hang'), {
              method: 'POST',
              body: stream,
              signal,
            }),
          this.server
        )
      ).to.be.rejectedWith(AbortError)
      expect(stream.destroyed).to.be.true
    })
  })

  describe('fetchNothing', function () {
    it('closes the connection', async function () {
      await fetchNothing(this.url('/large'))
      await expectRequestAborted(this.server.lastReq)
    })

    it('aborts the request when the request body is destroyed before transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      const promise = fetchNothing(this.url('/hang'), {
        method: 'POST',
        body: stream,
      })
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      expect(this.server.lastReq).to.be.undefined
    })

    it('aborts the request when the request body is destroyed during transfer', async function () {
      const stream = Readable.from(infiniteIterator())
      // Note: this test won't work on `/hang`
      const promise = fetchNothing(this.url('/sink'), {
        method: 'POST',
        body: stream,
      })
      await once(this.server.events, 'request-received')
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
      await wait(80)
      await expectRequestAborted(this.server.lastReq)
    })

    it("doesn't abort the request if the request body ends normally", async function () {
      const stream = Readable.from('hello there')
      await fetchNothing(this.url('/sink'), { method: 'POST', body: stream })
    })

    it('handles errors', async function () {
      await expect(fetchNothing(this.url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(this.server.lastReq)
    })

    it('supports abort signals', async function () {
      await expect(
        abortOnceReceived(
          signal => fetchNothing(this.url('/hang'), { signal }),
          this.server
        )
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(this.server.lastReq)
    })

    it('destroys the request body when an error occurs', async function () {
      const stream = Readable.from(infiniteIterator())
      await expect(
        abortOnceReceived(
          signal =>
            fetchNothing(this.url('/hang'), {
              method: 'POST',
              body: stream,
              signal,
            }),
          this.server
        )
      ).to.be.rejectedWith(AbortError)
      expect(stream.destroyed).to.be.true
    })
  })

  describe('fetchString', function () {
    it('returns a string', async function () {
      const body = await fetchString(this.url('/hello'))
      expect(body).to.equal('hello')
    })

    it('handles errors', async function () {
      await expect(fetchString(this.url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(this.server.lastReq)
    })
  })

  describe('fetchRedirect', function () {
    it('returns the immediate redirect', async function () {
      const body = await fetchRedirect(this.url('/redirect/1'))
      expect(body).to.equal(this.url('/redirect/2'))
    })

    it('rejects status 200', async function () {
      await expect(fetchRedirect(this.url('/hello'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(this.server.lastReq)
    })

    it('rejects empty redirect', async function () {
      await expect(fetchRedirect(this.url('/redirect/empty-location')))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.property('cause')
        .and.to.have.property('message')
        .to.equal('missing Location response header on 3xx response')
      await expectRequestAborted(this.server.lastReq)
    })

    it('handles errors', async function () {
      await expect(fetchRedirect(this.url('/500'))).to.be.rejectedWith(
        RequestFailedError
      )
      await expectRequestAborted(this.server.lastReq)
    })
  })

  describe('CustomHttpAgent', function () {
    it('makes an http request successfully', async function () {
      const agent = new CustomHttpAgent({ connectTimeout: 100 })
      const body = await fetchString(this.url('/hello'), { agent })
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
  })

  describe('CustomHttpsAgent', function () {
    it('makes an https request successfully', async function () {
      const agent = new CustomHttpsAgent({
        connectTimeout: 100,
        ca: PUBLIC_CERT,
      })
      const body = await fetchString(this.httpsUrl('/hello'), { agent })
      expect(body).to.equal('hello')
    })

    it('rejects an untrusted server', async function () {
      const agent = new CustomHttpsAgent({
        connectTimeout: 100,
      })
      await expect(fetchString(this.httpsUrl('/hello'), { agent }))
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
  await once(server.events, 'request-received')
  controller.abort()
  return await promise
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
