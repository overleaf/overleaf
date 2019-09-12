/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/User/UserSessionsManager.js'
const SandboxedModule = require('sandboxed-module')
const Async = require('async')

describe('UserSessionsManager', function() {
  beforeEach(function() {
    this.user = {
      _id: 'abcd',
      email: 'user@example.com'
    }
    this.sessionId = 'some_session_id'

    this.rclient = {
      multi: sinon.stub(),
      exec: sinon.stub(),
      get: sinon.stub(),
      del: sinon.stub(),
      sadd: sinon.stub(),
      srem: sinon.stub(),
      smembers: sinon.stub(),
      mget: sinon.stub(),
      pexpire: sinon.stub()
    }
    this.rclient.multi.returns(this.rclient)
    this.rclient.get.returns(this.rclient)
    this.rclient.del.returns(this.rclient)
    this.rclient.sadd.returns(this.rclient)
    this.rclient.srem.returns(this.rclient)
    this.rclient.smembers.returns(this.rclient)
    this.rclient.pexpire.returns(this.rclient)
    this.rclient.exec.callsArgWith(0, null)

    this.UserSessionsRedis = {
      client: () => this.rclient,
      sessionSetKey: user => `UserSessions:{${user._id}}`
    }
    this.logger = {
      err: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      log: sinon.stub()
    }
    this.settings = {
      redis: {
        web: {}
      }
    }
    return (this.UserSessionsManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': this.logger,
        'settings-sharelatex': this.settings,
        './UserSessionsRedis': this.UserSessionsRedis,
        async: Async
      }
    }))
  })

  describe('_sessionKey', function() {
    it('should build the correct key', function() {
      const result = this.UserSessionsManager._sessionKey(this.sessionId)
      return result.should.equal('sess:some_session_id')
    })
  })

  describe('trackSession', function() {
    beforeEach(function() {
      this.call = callback => {
        return this.UserSessionsManager.trackSession(
          this.user,
          this.sessionId,
          callback
        )
      }
      this.rclient.exec.callsArgWith(0, null)
      return (this._checkSessions = sinon
        .stub(this.UserSessionsManager, '_checkSessions')
        .returns(null))
    })

    afterEach(function() {
      return this._checkSessions.restore()
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.not.be.instanceof(Error)
        return done()
      })
    })

    it('should call the appropriate redis methods', function(done) {
      return this.call(err => {
        this.rclient.multi.callCount.should.equal(1)
        this.rclient.sadd.callCount.should.equal(1)
        this.rclient.pexpire.callCount.should.equal(1)
        this.rclient.exec.callCount.should.equal(1)
        return done()
      })
    })

    it('should call _checkSessions', function(done) {
      return this.call(err => {
        this._checkSessions.callCount.should.equal(1)
        return done()
      })
    })

    describe('when rclient produces an error', function() {
      beforeEach(function() {
        return this.rclient.exec.callsArgWith(0, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not call _checkSessions', function(done) {
        return this.call(err => {
          this._checkSessions.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when no user is supplied', function() {
      beforeEach(function() {
        return (this.call = callback => {
          return this.UserSessionsManager.trackSession(
            null,
            this.sessionId,
            callback
          )
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not call the appropriate redis methods', function(done) {
        return this.call(err => {
          this.rclient.multi.callCount.should.equal(0)
          this.rclient.sadd.callCount.should.equal(0)
          this.rclient.pexpire.callCount.should.equal(0)
          this.rclient.exec.callCount.should.equal(0)
          return done()
        })
      })

      it('should not call _checkSessions', function(done) {
        return this.call(err => {
          this._checkSessions.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when no sessionId is supplied', function() {
      beforeEach(function() {
        return (this.call = callback => {
          return this.UserSessionsManager.trackSession(
            this.user,
            null,
            callback
          )
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not call the appropriate redis methods', function(done) {
        return this.call(err => {
          this.rclient.multi.callCount.should.equal(0)
          this.rclient.sadd.callCount.should.equal(0)
          this.rclient.pexpire.callCount.should.equal(0)
          this.rclient.exec.callCount.should.equal(0)
          return done()
        })
      })

      it('should not call _checkSessions', function(done) {
        return this.call(err => {
          this._checkSessions.callCount.should.equal(0)
          return done()
        })
      })
    })
  })

  describe('untrackSession', function() {
    beforeEach(function() {
      this.call = callback => {
        return this.UserSessionsManager.untrackSession(
          this.user,
          this.sessionId,
          callback
        )
      }
      this.rclient.exec.callsArgWith(0, null)
      return (this._checkSessions = sinon
        .stub(this.UserSessionsManager, '_checkSessions')
        .returns(null))
    })

    afterEach(function() {
      return this._checkSessions.restore()
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.not.be.instanceof(Error)
        expect(err).to.equal(undefined)
        return done()
      })
    })

    it('should call the appropriate redis methods', function(done) {
      return this.call(err => {
        this.rclient.multi.callCount.should.equal(1)
        this.rclient.srem.callCount.should.equal(1)
        this.rclient.pexpire.callCount.should.equal(1)
        this.rclient.exec.callCount.should.equal(1)
        return done()
      })
    })

    it('should call _checkSessions', function(done) {
      return this.call(err => {
        this._checkSessions.callCount.should.equal(1)
        return done()
      })
    })

    describe('when rclient produces an error', function() {
      beforeEach(function() {
        return this.rclient.exec.callsArgWith(0, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not call _checkSessions', function(done) {
        return this.call(err => {
          this._checkSessions.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when no user is supplied', function() {
      beforeEach(function() {
        return (this.call = callback => {
          return this.UserSessionsManager.untrackSession(
            null,
            this.sessionId,
            callback
          )
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not call the appropriate redis methods', function(done) {
        return this.call(err => {
          this.rclient.multi.callCount.should.equal(0)
          this.rclient.srem.callCount.should.equal(0)
          this.rclient.pexpire.callCount.should.equal(0)
          this.rclient.exec.callCount.should.equal(0)
          return done()
        })
      })

      it('should not call _checkSessions', function(done) {
        return this.call(err => {
          this._checkSessions.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when no sessionId is supplied', function() {
      beforeEach(function() {
        return (this.call = callback => {
          return this.UserSessionsManager.untrackSession(
            this.user,
            null,
            callback
          )
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not call the appropriate redis methods', function(done) {
        return this.call(err => {
          this.rclient.multi.callCount.should.equal(0)
          this.rclient.srem.callCount.should.equal(0)
          this.rclient.pexpire.callCount.should.equal(0)
          this.rclient.exec.callCount.should.equal(0)
          return done()
        })
      })

      it('should not call _checkSessions', function(done) {
        return this.call(err => {
          this._checkSessions.callCount.should.equal(0)
          return done()
        })
      })
    })
  })

  describe('revokeAllUserSessions', function() {
    beforeEach(function() {
      this.sessionKeys = ['sess:one', 'sess:two']
      this.retain = []
      this.rclient.smembers.callsArgWith(1, null, this.sessionKeys)
      this.rclient.del = sinon.stub().callsArgWith(1, null)
      this.rclient.srem = sinon.stub().callsArgWith(2, null)
      return (this.call = callback => {
        return this.UserSessionsManager.revokeAllUserSessions(
          this.user,
          this.retain,
          callback
        )
      })
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.not.be.instanceof(Error)
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should call the appropriate redis methods', function(done) {
      return this.call(err => {
        this.rclient.smembers.callCount.should.equal(1)

        this.rclient.del.callCount.should.equal(2)
        expect(this.rclient.del.firstCall.args[0]).to.deep.equal(
          this.sessionKeys[0]
        )
        expect(this.rclient.del.secondCall.args[0]).to.deep.equal(
          this.sessionKeys[1]
        )

        this.rclient.srem.callCount.should.equal(1)
        expect(this.rclient.srem.firstCall.args[1]).to.deep.equal(
          this.sessionKeys
        )

        return done()
      })
    })

    describe('when a session is retained', function() {
      beforeEach(function() {
        this.sessionKeys = ['sess:one', 'sess:two', 'sess:three', 'sess:four']
        this.retain = ['two']
        this.rclient.smembers.callsArgWith(1, null, this.sessionKeys)
        this.rclient.del = sinon.stub().callsArgWith(1, null)
        return (this.call = callback => {
          return this.UserSessionsManager.revokeAllUserSessions(
            this.user,
            this.retain,
            callback
          )
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should call the appropriate redis methods', function(done) {
        return this.call(err => {
          this.rclient.smembers.callCount.should.equal(1)
          this.rclient.del.callCount.should.equal(this.sessionKeys.length - 1)
          this.rclient.srem.callCount.should.equal(1)
          return done()
        })
      })

      it('should remove all sessions except for the retained one', function(done) {
        return this.call(err => {
          expect(this.rclient.del.firstCall.args[0]).to.deep.equal('sess:one')
          expect(this.rclient.del.secondCall.args[0]).to.deep.equal(
            'sess:three'
          )
          expect(this.rclient.del.thirdCall.args[0]).to.deep.equal('sess:four')
          expect(this.rclient.srem.firstCall.args[1]).to.deep.equal([
            'sess:one',
            'sess:three',
            'sess:four'
          ])
          return done()
        })
      })
    })

    describe('when rclient produces an error', function() {
      beforeEach(function() {
        return (this.rclient.del = sinon
          .stub()
          .callsArgWith(1, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not call rclient.srem', function(done) {
        return this.call(err => {
          this.rclient.srem.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when no user is supplied', function() {
      beforeEach(function() {
        return (this.call = callback => {
          return this.UserSessionsManager.revokeAllUserSessions(
            null,
            this.retain,
            callback
          )
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not call the appropriate redis methods', function(done) {
        return this.call(err => {
          this.rclient.smembers.callCount.should.equal(0)
          this.rclient.del.callCount.should.equal(0)
          this.rclient.srem.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when there are no keys to delete', function() {
      beforeEach(function() {
        return this.rclient.smembers.callsArgWith(1, null, [])
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not do the delete operation', function(done) {
        return this.call(err => {
          this.rclient.smembers.callCount.should.equal(1)
          this.rclient.del.callCount.should.equal(0)
          this.rclient.srem.callCount.should.equal(0)
          return done()
        })
      })
    })
  })

  describe('touch', function() {
    beforeEach(function() {
      this.rclient.pexpire.callsArgWith(2, null)
      return (this.call = callback => {
        return this.UserSessionsManager.touch(this.user, callback)
      })
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.not.be.instanceof(Error)
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should call rclient.pexpire', function(done) {
      return this.call(err => {
        this.rclient.pexpire.callCount.should.equal(1)
        return done()
      })
    })

    describe('when rclient produces an error', function() {
      beforeEach(function() {
        return this.rclient.pexpire.callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })

    describe('when no user is supplied', function() {
      beforeEach(function() {
        return (this.call = callback => {
          return this.UserSessionsManager.touch(null, callback)
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not call pexpire', function(done) {
        return this.call(err => {
          this.rclient.pexpire.callCount.should.equal(0)
          return done()
        })
      })
    })
  })

  describe('getAllUserSessions', function() {
    beforeEach(function() {
      this.sessionKeys = ['sess:one', 'sess:two', 'sess:three']
      this.sessions = [
        '{"user": {"ip_address": "a", "session_created": "b"}}',
        '{"passport": {"user": {"ip_address": "c", "session_created": "d"}}}'
      ]
      this.exclude = ['two']
      this.rclient.smembers.callsArgWith(1, null, this.sessionKeys)
      this.rclient.get = sinon.stub()
      this.rclient.get.onCall(0).callsArgWith(1, null, this.sessions[0])
      this.rclient.get.onCall(1).callsArgWith(1, null, this.sessions[1])

      return (this.call = callback => {
        return this.UserSessionsManager.getAllUserSessions(
          this.user,
          this.exclude,
          callback
        )
      })
    })

    it('should not produce an error', function(done) {
      return this.call((err, sessions) => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should get sessions', function(done) {
      return this.call((err, sessions) => {
        expect(sessions).to.deep.equal([
          { ip_address: 'a', session_created: 'b' },
          { ip_address: 'c', session_created: 'd' }
        ])
        return done()
      })
    })

    it('should have called rclient.smembers', function(done) {
      return this.call((err, sessions) => {
        this.rclient.smembers.callCount.should.equal(1)
        return done()
      })
    })

    it('should have called rclient.get', function(done) {
      return this.call((err, sessions) => {
        this.rclient.get.callCount.should.equal(this.sessionKeys.length - 1)
        return done()
      })
    })

    describe('when there are no other sessions', function() {
      beforeEach(function() {
        this.sessionKeys = ['sess:two']
        return this.rclient.smembers.callsArgWith(1, null, this.sessionKeys)
      })

      it('should not produce an error', function(done) {
        return this.call((err, sessions) => {
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should produce an empty list of sessions', function(done) {
        return this.call((err, sessions) => {
          expect(sessions).to.deep.equal([])
          return done()
        })
      })

      it('should have called rclient.smembers', function(done) {
        return this.call((err, sessions) => {
          this.rclient.smembers.callCount.should.equal(1)
          return done()
        })
      })

      it('should not have called rclient.mget', function(done) {
        return this.call((err, sessions) => {
          this.rclient.mget.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when smembers produces an error', function() {
      beforeEach(function() {
        return this.rclient.smembers.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, sessions) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not have called rclient.mget', function(done) {
        return this.call((err, sessions) => {
          this.rclient.mget.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when get produces an error', function() {
      beforeEach(function() {
        return (this.rclient.get = sinon
          .stub()
          .callsArgWith(1, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call((err, sessions) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('_checkSessions', function() {
    beforeEach(function() {
      this.call = callback => {
        return this.UserSessionsManager._checkSessions(this.user, callback)
      }
      this.sessionKeys = ['one', 'two']
      this.rclient.smembers.callsArgWith(1, null, this.sessionKeys)
      this.rclient.get.callsArgWith(1, null, 'some-value')
      return this.rclient.srem.callsArgWith(2, null, {})
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.not.be.instanceof(Error)
        expect(err).to.equal(undefined)
        return done()
      })
    })

    it('should call the appropriate redis methods', function(done) {
      return this.call(err => {
        this.rclient.smembers.callCount.should.equal(1)
        this.rclient.get.callCount.should.equal(2)
        this.rclient.srem.callCount.should.equal(0)
        return done()
      })
    })

    describe('when one of the keys is not present in redis', function() {
      beforeEach(function() {
        this.rclient.get.onCall(0).callsArgWith(1, null, 'some-val')
        return this.rclient.get.onCall(1).callsArgWith(1, null, null)
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(undefined)
          return done()
        })
      })

      it('should remove that key from the set', function(done) {
        return this.call(err => {
          this.rclient.smembers.callCount.should.equal(1)
          this.rclient.get.callCount.should.equal(2)
          this.rclient.srem.callCount.should.equal(1)
          this.rclient.srem.firstCall.args[1].should.equal('two')
          return done()
        })
      })
    })

    describe('when no user is supplied', function() {
      beforeEach(function() {
        return (this.call = callback => {
          return this.UserSessionsManager._checkSessions(null, callback)
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should not call redis methods', function(done) {
        return this.call(err => {
          this.rclient.smembers.callCount.should.equal(0)
          this.rclient.get.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when one of the get operations produces an error', function() {
      beforeEach(function() {
        this.rclient.get.onCall(0).callsArgWith(1, new Error('woops'), null)
        return this.rclient.get.onCall(1).callsArgWith(1, null, null)
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should call the right redis methods, bailing out early', function(done) {
        return this.call(err => {
          this.rclient.smembers.callCount.should.equal(1)
          this.rclient.get.callCount.should.equal(1)
          this.rclient.srem.callCount.should.equal(0)
          return done()
        })
      })
    })
  })
})
