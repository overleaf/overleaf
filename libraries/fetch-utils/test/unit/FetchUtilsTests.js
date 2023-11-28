const { expect } = require('chai')
const { FetchError, AbortError } = require('node-fetch')
const { Readable } = require('stream')
const { once } = require('events')
const { TestServer } = require('./helpers/TestServer')
const {
  fetchJson,
  fetchStream,
  fetchNothing,
  fetchRedirect,
  fetchString,
  RequestFailedError,
} = require('../..')

const PORT = 30001

describe('fetch-utils', function () {
  before(async function () {
    this.server = new TestServer()
    await this.server.start(PORT)
    this.url = path => `http://localhost:${PORT}${path}`
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
        fetchJson(this.url('/hang'), { signal: AbortSignal.timeout(10) })
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

    it('aborts the request when the request body is destroyed', async function () {
      const stream = Readable.from(infiniteIterator())
      const promise = fetchStream(this.url('/hang'), {
        method: 'POST',
        body: stream,
      })
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
        fetchStream(this.url('/hang'), { signal: AbortSignal.timeout(10) })
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(this.server.lastReq)
    })

    it('destroys the request body when an error occurs', async function () {
      const stream = Readable.from(infiniteIterator())
      await expect(
        fetchStream(this.url('/hang'), {
          body: stream,
          signal: AbortSignal.timeout(10),
        })
      ).to.be.rejectedWith(AbortError)
      expect(stream.destroyed).to.be.true
    })
  })

  describe('fetchNothing', function () {
    it('closes the connection', async function () {
      await fetchNothing(this.url('/large'))
      await expectRequestAborted(this.server.lastReq)
    })

    it('aborts the request when the request body is destroyed', async function () {
      const stream = Readable.from(infiniteIterator())
      const promise = fetchNothing(this.url('/hang'), {
        method: 'POST',
        body: stream,
      })
      stream.destroy()
      await expect(promise).to.be.rejectedWith(AbortError)
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
        fetchNothing(this.url('/hang'), { signal: AbortSignal.timeout(10) })
      ).to.be.rejectedWith(AbortError)
      await expectRequestAborted(this.server.lastReq)
    })

    it('destroys the request body when an error occurs', async function () {
      const stream = Readable.from(infiniteIterator())
      await expect(
        fetchNothing(this.url('/hang'), {
          body: stream,
          signal: AbortSignal.timeout(10),
        })
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

async function expectRequestAborted(req) {
  if (!req.destroyed) {
    await once(req, 'close')
    expect(req.destroyed).to.be.true
  }
}
