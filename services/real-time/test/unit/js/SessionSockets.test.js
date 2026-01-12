import { vi, expect, describe, beforeEach, it } from 'vitest'
import { EventEmitter } from 'node:events'
import sinon from 'sinon'
const modulePath = '../../../app/js/SessionSockets'

describe('SessionSockets', function () {
  beforeEach(async function (ctx) {
    ctx.metrics = { inc: sinon.stub() }

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.metrics,
    }))

    ctx.SessionSocketsModule = (await import(modulePath)).default
    ctx.io = new EventEmitter()
    ctx.id1 = Math.random().toString()
    ctx.id2 = Math.random().toString()
    const redisResponses = {
      error: [new Error('Redis: something went wrong'), null],
      unknownId: [null, null],
    }
    redisResponses[ctx.id1] = [null, { user: { _id: '123' } }]
    redisResponses[ctx.id2] = [null, { user: { _id: 'abc' } }]

    ctx.sessionStore = {
      get: sinon
        .stub()
        .callsFake((id, fn) => fn.apply(null, redisResponses[id])),
    }
    ctx.cookieParser = function (req, res, next) {
      req.signedCookies = req._signedCookies
      return next()
    }
    ctx.SessionSockets = ctx.SessionSocketsModule(
      ctx.io,
      ctx.sessionStore,
      ctx.cookieParser,
      'ol.sid'
    )
    ctx.checkSocket = (socket, fn) => {
      ctx.SessionSockets.once('connection', fn)
      return ctx.io.emit('connection', socket)
    }
  })

  describe('without cookies', function () {
    beforeEach(function (ctx) {
      ctx.socket = { handshake: {} }
    })

    it('should return a lookup error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, error => {
          expect(error).to.exist
          expect(error.message).to.equal('could not look up session by key')
          resolve()
        })
      })
    })

    it('should not query redis', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.sessionStore.get.called).to.equal(false)
          resolve()
        })
      })
    })

    it('should increment the session.cookie metric with status "none"', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.metrics.inc).to.be.calledWith('session.cookie', 1, {
            status: 'none',
          })
          resolve()
        })
      })
    })
  })

  describe('with a different cookie', function () {
    beforeEach(function (ctx) {
      ctx.socket = { handshake: { _signedCookies: { other: 1 } } }
    })

    it('should return a lookup error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, error => {
          expect(error).to.exist
          expect(error.message).to.equal('could not look up session by key')
          resolve()
        })
      })
    })

    it('should not query redis', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.sessionStore.get.called).to.equal(false)
          resolve()
        })
      })
    })
  })

  describe('with a cookie with an invalid signature', function () {
    beforeEach(function (ctx) {
      ctx.socket = {
        handshake: { _signedCookies: { 'ol.sid': false } },
      }
    })

    it('should return a lookup error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, error => {
          expect(error).to.exist
          expect(error.message).to.equal('could not look up session by key')
          resolve()
        })
      })
    })

    it('should not query redis', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.sessionStore.get.called).to.equal(false)
          resolve()
        })
      })
    })

    it('should increment the session.cookie metric with status=bad-signature', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.metrics.inc).to.be.calledWith('session.cookie', 1, {
            status: 'bad-signature',
          })
          resolve()
        })
      })
    })
  })

  describe('with a valid cookie and a failing session lookup', function () {
    beforeEach(function (ctx) {
      ctx.socket = {
        handshake: { _signedCookies: { 'ol.sid': 'error' } },
      }
    })

    it('should query redis', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.sessionStore.get.called).to.equal(true)
          resolve()
        })
      })
    })

    it('should return a redis error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, error => {
          expect(error).to.exist
          expect(error.message).to.equal('Redis: something went wrong')
          resolve()
        })
      })
    })

    it('should increment the session.cookie metric with status=error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.metrics.inc).to.be.calledWith('session.cookie', 1, {
            status: 'error',
          })
          resolve()
        })
      })
    })
  })

  describe('with a valid cookie and no matching session', function () {
    beforeEach(function (ctx) {
      ctx.socket = {
        handshake: { _signedCookies: { 'ol.sid': 'unknownId' } },
      }
    })

    it('should query redis', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.sessionStore.get.called).to.equal(true)
          resolve()
        })
      })
    })

    it('should return a lookup error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, error => {
          expect(error).to.exist
          expect(error.message).to.equal('could not look up session by key')
          resolve()
        })
      })
    })

    it('should increment the session.cookie metric with status=missing', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.metrics.inc).to.be.calledWith('session.cookie', 1, {
            status: 'missing',
          })
          resolve()
        })
      })
    })
  })

  describe('with a valid cookie and a matching session', function () {
    beforeEach(function (ctx) {
      ctx.socket = {
        handshake: { _signedCookies: { 'ol.sid': ctx.id1 } },
      }
    })

    it('should query redis', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.sessionStore.get.called).to.equal(true)
          resolve()
        })
      })
    })

    it('should not return an error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, error => {
          expect(error).to.not.exist
          resolve()
        })
      })
    })

    it('should return the session', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, (error, s, session) => {
          if (error) return reject(error)
          expect(session).to.deep.equal({ user: { _id: '123' } })
          resolve()
        })
      })
    })

    it('should increment the session.cookie metric with status=signed', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.metrics.inc).to.be.calledWith('session.cookie', 1, {
            status: 'signed',
          })
          resolve()
        })
      })
    })
  })

  describe('with a different valid cookie and matching session', function () {
    beforeEach(function (ctx) {
      ctx.socket = {
        handshake: { _signedCookies: { 'ol.sid': ctx.id2 } },
      }
    })

    it('should query redis', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.sessionStore.get.called).to.equal(true)
          resolve()
        })
      })
    })

    it('should not return an error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, error => {
          expect(error).to.not.exist
          resolve()
        })
      })
    })

    it('should return the other session', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, (error, s, session) => {
          if (error) return reject(error)
          expect(session).to.deep.equal({ user: { _id: 'abc' } })
          resolve()
        })
      })
    })

    it('should increment the session.cookie metric with status=error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.checkSocket(ctx.socket, () => {
          expect(ctx.metrics.inc).to.be.calledWith('session.cookie', 1, {
            status: 'signed',
          })
          resolve()
        })
      })
    })
  })
})
