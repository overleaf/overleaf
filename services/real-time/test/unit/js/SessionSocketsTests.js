/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { EventEmitter } = require('node:events')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../app/js/SessionSockets'
const sinon = require('sinon')

describe('SessionSockets', function () {
  beforeEach(function () {
    this.metrics = { inc: sinon.stub() }
    this.SessionSocketsModule = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/metrics': this.metrics,
      },
    })
    this.io = new EventEmitter()
    this.id1 = Math.random().toString()
    this.id2 = Math.random().toString()
    const redisResponses = {
      error: [new Error('Redis: something went wrong'), null],
      unknownId: [null, null],
    }
    redisResponses[this.id1] = [null, { user: { _id: '123' } }]
    redisResponses[this.id2] = [null, { user: { _id: 'abc' } }]

    this.sessionStore = {
      get: sinon
        .stub()
        .callsFake((id, fn) => fn.apply(null, redisResponses[id])),
    }
    this.cookieParser = function (req, res, next) {
      req.signedCookies = req._signedCookies
      return next()
    }
    this.SessionSockets = this.SessionSocketsModule(
      this.io,
      this.sessionStore,
      this.cookieParser,
      'ol.sid'
    )
    return (this.checkSocket = (socket, fn) => {
      this.SessionSockets.once('connection', fn)
      return this.io.emit('connection', socket)
    })
  })

  describe('without cookies', function () {
    beforeEach(function () {
      return (this.socket = { handshake: {} })
    })

    it('should return a lookup error', function (done) {
      return this.checkSocket(this.socket, error => {
        expect(error).to.exist
        expect(error.message).to.equal('could not look up session by key')
        return done()
      })
    })

    it('should not query redis', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.sessionStore.get.called).to.equal(false)
        return done()
      })
    })

    it('should increment the session.cookie metric with status "none"', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.metrics.inc).to.be.calledWith('session.cookie', 1, {
          status: 'none',
        })
        return done()
      })
    })
  })

  describe('with a different cookie', function () {
    beforeEach(function () {
      return (this.socket = { handshake: { _signedCookies: { other: 1 } } })
    })

    it('should return a lookup error', function (done) {
      return this.checkSocket(this.socket, error => {
        expect(error).to.exist
        expect(error.message).to.equal('could not look up session by key')
        return done()
      })
    })

    it('should not query redis', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.sessionStore.get.called).to.equal(false)
        return done()
      })
    })
  })

  describe('with a cookie with an invalid signature', function () {
    beforeEach(function () {
      return (this.socket = {
        handshake: { _signedCookies: { 'ol.sid': false } },
      })
    })

    it('should return a lookup error', function (done) {
      return this.checkSocket(this.socket, error => {
        expect(error).to.exist
        expect(error.message).to.equal('could not look up session by key')
        return done()
      })
    })

    it('should not query redis', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.sessionStore.get.called).to.equal(false)
        return done()
      })
    })

    it('should increment the session.cookie metric with status=bad-signature', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.metrics.inc).to.be.calledWith('session.cookie', 1, {
          status: 'bad-signature',
        })
        return done()
      })
    })
  })

  describe('with a valid cookie and a failing session lookup', function () {
    beforeEach(function () {
      return (this.socket = {
        handshake: { _signedCookies: { 'ol.sid': 'error' } },
      })
    })

    it('should query redis', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.sessionStore.get.called).to.equal(true)
        return done()
      })
    })

    it('should return a redis error', function (done) {
      return this.checkSocket(this.socket, error => {
        expect(error).to.exist
        expect(error.message).to.equal('Redis: something went wrong')
        return done()
      })
    })

    it('should increment the session.cookie metric with status=error', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.metrics.inc).to.be.calledWith('session.cookie', 1, {
          status: 'error',
        })
        return done()
      })
    })
  })

  describe('with a valid cookie and no matching session', function () {
    beforeEach(function () {
      return (this.socket = {
        handshake: { _signedCookies: { 'ol.sid': 'unknownId' } },
      })
    })

    it('should query redis', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.sessionStore.get.called).to.equal(true)
        return done()
      })
    })

    it('should return a lookup error', function (done) {
      return this.checkSocket(this.socket, error => {
        expect(error).to.exist
        expect(error.message).to.equal('could not look up session by key')
        return done()
      })
    })

    it('should increment the session.cookie metric with status=missing', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.metrics.inc).to.be.calledWith('session.cookie', 1, {
          status: 'missing',
        })
        return done()
      })
    })
  })

  describe('with a valid cookie and a matching session', function () {
    beforeEach(function () {
      return (this.socket = {
        handshake: { _signedCookies: { 'ol.sid': this.id1 } },
      })
    })

    it('should query redis', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.sessionStore.get.called).to.equal(true)
        return done()
      })
    })

    it('should not return an error', function (done) {
      return this.checkSocket(this.socket, error => {
        expect(error).to.not.exist
        return done()
      })
    })

    it('should return the session', function (done) {
      return this.checkSocket(this.socket, (error, s, session) => {
        if (error) return done(error)
        expect(session).to.deep.equal({ user: { _id: '123' } })
        return done()
      })
    })

    it('should increment the session.cookie metric with status=signed', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.metrics.inc).to.be.calledWith('session.cookie', 1, {
          status: 'signed',
        })
        return done()
      })
    })
  })

  describe('with a different valid cookie and matching session', function () {
    beforeEach(function () {
      return (this.socket = {
        handshake: { _signedCookies: { 'ol.sid': this.id2 } },
      })
    })

    it('should query redis', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.sessionStore.get.called).to.equal(true)
        return done()
      })
    })

    it('should not return an error', function (done) {
      return this.checkSocket(this.socket, error => {
        expect(error).to.not.exist
        return done()
      })
    })

    it('should return the other session', function (done) {
      return this.checkSocket(this.socket, (error, s, session) => {
        if (error) return done(error)
        expect(session).to.deep.equal({ user: { _id: 'abc' } })
        return done()
      })
    })

    it('should increment the session.cookie metric with status=error', function (done) {
      return this.checkSocket(this.socket, () => {
        expect(this.metrics.inc).to.be.calledWith('session.cookie', 1, {
          status: 'signed',
        })
        return done()
      })
    })
  })
})
