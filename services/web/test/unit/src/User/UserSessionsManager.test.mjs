const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/User/UserSessionsManager.js'
const SandboxedModule = require('sandboxed-module')

describe('UserSessionsManager', function () {
  beforeEach(function () {
    this.user = {
      _id: 'abcd',
      email: 'user@example.com',
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
      pexpire: sinon.stub(),
    }
    this.rclient.multi.returns({
      sadd: sinon.stub().returnsThis(),
      srem: sinon.stub().returnsThis(),
      pexpire: sinon.stub().returnsThis(),
      exec: sinon.stub().resolves(),
    })
    this.rclient.get.resolves()
    this.rclient.del.resolves()
    this.rclient.sadd.resolves()
    this.rclient.srem.resolves()
    this.rclient.smembers.resolves([])
    this.rclient.pexpire.resolves()

    this.UserSessionsRedis = {
      client: () => this.rclient,
      sessionSetKey: user => `UserSessions:{${user._id}}`,
    }
    this.settings = {
      redis: {
        web: {},
      },
    }
    return (this.UserSessionsManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        './UserSessionsRedis': this.UserSessionsRedis,
      },
    }))
  })

  describe('_sessionKey', function () {
    it('should build the correct key', function () {
      const result = this.UserSessionsManager._sessionKey(this.sessionId)
      return result.should.equal('sess:some_session_id')
    })
  })

  describe('trackSession', function () {
    beforeEach(function () {
      this._checkSessions = sinon
        .stub(this.UserSessionsManager.promises, '_checkSessions')
        .resolves()
    })

    afterEach(function () {
      return this._checkSessions.restore()
    })

    it('should not produce an error', async function () {
      await this.UserSessionsManager.promises.trackSession(
        this.user,
        this.sessionId
      )
    })

    it('should call the appropriate redis methods', async function () {
      await this.UserSessionsManager.promises.trackSession(
        this.user,
        this.sessionId
      )
      this.rclient.multi.callCount.should.equal(1)
      const multiInstance = this.rclient.multi.returnValues[0]
      multiInstance.sadd.callCount.should.equal(1)
      multiInstance.pexpire.callCount.should.equal(1)
      multiInstance.exec.callCount.should.equal(1)
    })

    it('should call _checkSessions', async function () {
      await this.UserSessionsManager.promises.trackSession(
        this.user,
        this.sessionId
      )
      this._checkSessions.callCount.should.equal(1)
    })

    describe('when rclient produces an error', function () {
      beforeEach(function () {
        this.rclient.multi.returns({
          sadd: sinon.stub().returnsThis(),
          pexpire: sinon.stub().returnsThis(),
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises.trackSession(
            this.user,
            this.sessionId
          )
        ).to.be.rejectedWith(Error)
      })

      it('should not call _checkSessions', async function () {
        try {
          await this.UserSessionsManager.promises.trackSession(
            this.user,
            this.sessionId
          )
        } catch (err) {
          // Expected error
        }
        this._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.trackSession(
          null,
          this.sessionId
        )
      })

      it('should not call the appropriate redis methods', async function () {
        await this.UserSessionsManager.promises.trackSession(
          null,
          this.sessionId
        )
        this.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function () {
        await this.UserSessionsManager.promises.trackSession(
          null,
          this.sessionId
        )
        this._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no sessionId is supplied', function () {
      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.trackSession(this.user, null)
      })

      it('should not call the appropriate redis methods', async function () {
        await this.UserSessionsManager.promises.trackSession(this.user, null)
        this.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function () {
        await this.UserSessionsManager.promises.trackSession(this.user, null)
        this._checkSessions.callCount.should.equal(0)
      })
    })
  })

  describe('untrackSession', function () {
    beforeEach(function () {
      this._checkSessions = sinon
        .stub(this.UserSessionsManager.promises, '_checkSessions')
        .resolves()
    })

    afterEach(function () {
      return this._checkSessions.restore()
    })

    it('should not produce an error', async function () {
      await this.UserSessionsManager.promises.untrackSession(
        this.user,
        this.sessionId
      )
    })

    it('should call the appropriate redis methods', async function () {
      await this.UserSessionsManager.promises.untrackSession(
        this.user,
        this.sessionId
      )
      this.rclient.multi.callCount.should.equal(1)
      const multiInstance = this.rclient.multi.returnValues[0]
      multiInstance.srem.callCount.should.equal(1)
      multiInstance.pexpire.callCount.should.equal(1)
      multiInstance.exec.callCount.should.equal(1)
    })

    it('should call _checkSessions', async function () {
      await this.UserSessionsManager.promises.untrackSession(
        this.user,
        this.sessionId
      )
      this._checkSessions.callCount.should.equal(1)
    })

    describe('when rclient produces an error', function () {
      beforeEach(function () {
        this.rclient.multi.returns({
          srem: sinon.stub().returnsThis(),
          pexpire: sinon.stub().returnsThis(),
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises.untrackSession(
            this.user,
            this.sessionId
          )
        ).to.be.rejectedWith(Error)
      })

      it('should not call _checkSessions', async function () {
        try {
          await this.UserSessionsManager.promises.untrackSession(
            this.user,
            this.sessionId
          )
        } catch (err) {
          // Expected error
        }
        this._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.untrackSession(
          null,
          this.sessionId
        )
      })

      it('should not call the appropriate redis methods', async function () {
        await this.UserSessionsManager.promises.untrackSession(
          null,
          this.sessionId
        )
        this.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function () {
        await this.UserSessionsManager.promises.untrackSession(
          null,
          this.sessionId
        )
        this._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no sessionId is supplied', function () {
      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.untrackSession(this.user, null)
      })

      it('should not call the appropriate redis methods', async function () {
        await this.UserSessionsManager.promises.untrackSession(this.user, null)
        this.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function () {
        await this.UserSessionsManager.promises.untrackSession(this.user, null)
        this._checkSessions.callCount.should.equal(0)
      })
    })
  })

  describe('removeSessionsFromRedis', function () {
    beforeEach(function () {
      this.sessionKeys = ['sess:one', 'sess:two']
      this.currentSessionID = undefined
      this.rclient.smembers.resolves(this.sessionKeys)
      this.rclient.del.resolves()
      this.rclient.srem.resolves()
    })

    it('should not produce an error', async function () {
      await this.UserSessionsManager.promises.removeSessionsFromRedis(
        this.user,
        this.currentSessionID
      )
    })

    it('should yield the number of purged sessions', async function () {
      const result =
        await this.UserSessionsManager.promises.removeSessionsFromRedis(
          this.user,
          this.currentSessionID
        )
      expect(result).to.equal(this.sessionKeys.length)
    })

    it('should call the appropriate redis methods', async function () {
      await this.UserSessionsManager.promises.removeSessionsFromRedis(
        this.user,
        this.currentSessionID
      )
      this.rclient.smembers.callCount.should.equal(1)

      this.rclient.del.callCount.should.equal(2)
      expect(this.rclient.del.firstCall.args[0]).to.deep.equal(
        this.sessionKeys[0]
      )
      expect(this.rclient.del.secondCall.args[0]).to.deep.equal(
        this.sessionKeys[1]
      )

      this.rclient.srem.callCount.should.equal(1)
      expect(this.rclient.srem.firstCall.args[0]).to.deep.equal(
        'UserSessions:{abcd}'
      )
      expect(this.rclient.srem.firstCall.args[1]).to.deep.equal(
        this.sessionKeys
      )
    })

    describe('when a session is retained', function () {
      beforeEach(function () {
        this.sessionKeys = ['sess:one', 'sess:two', 'sess:three', 'sess:four']
        this.currentSessionID = 'two'
        this.rclient.smembers.resolves(this.sessionKeys)
        this.rclient.del.resolves()
      })

      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.removeSessionsFromRedis(
          this.user,
          this.currentSessionID
        )
      })

      it('should call the appropriate redis methods', async function () {
        await this.UserSessionsManager.promises.removeSessionsFromRedis(
          this.user,
          this.currentSessionID
        )
        this.rclient.smembers.callCount.should.equal(1)
        this.rclient.del.callCount.should.equal(this.sessionKeys.length - 1)
        this.rclient.srem.callCount.should.equal(1)
      })

      it('should remove all sessions except for the retained one', async function () {
        await this.UserSessionsManager.promises.removeSessionsFromRedis(
          this.user,
          this.currentSessionID
        )
        expect(this.rclient.del.firstCall.args[0]).to.deep.equal('sess:one')
        expect(this.rclient.del.secondCall.args[0]).to.deep.equal('sess:three')
        expect(this.rclient.del.thirdCall.args[0]).to.deep.equal('sess:four')
        expect(this.rclient.srem.firstCall.args[1]).to.deep.equal([
          'sess:one',
          'sess:three',
          'sess:four',
        ])
      })
    })

    describe('when rclient produces an error', function () {
      beforeEach(function () {
        this.rclient.del.rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises.removeSessionsFromRedis(
            this.user,
            this.currentSessionID
          )
        ).to.be.rejectedWith(Error)
      })

      it('should not call rclient.srem', async function () {
        try {
          await this.UserSessionsManager.promises.removeSessionsFromRedis(
            this.user,
            this.currentSessionID
          )
        } catch (err) {
          // Expected error
        }
        this.rclient.srem.callCount.should.equal(0)
      })
    })

    describe('when no user is supplied', function () {
      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises.removeSessionsFromRedis(
            null,
            this.currentSessionID
          )
        ).to.be.rejectedWith(/bug: user not passed to removeSessionsFromRedis/)
      })

      it('should not call the appropriate redis methods', async function () {
        try {
          await this.UserSessionsManager.promises.removeSessionsFromRedis(
            null,
            this.currentSessionID
          )
        } catch (err) {
          // Expected error
        }
        this.rclient.smembers.callCount.should.equal(0)
        this.rclient.del.callCount.should.equal(0)
        this.rclient.srem.callCount.should.equal(0)
      })
    })

    describe('when there are no keys to delete', function () {
      beforeEach(function () {
        this.rclient.smembers.resolves([])
      })

      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.removeSessionsFromRedis(
          this.user,
          this.currentSessionID
        )
      })

      it('should not do the delete operation', async function () {
        await this.UserSessionsManager.promises.removeSessionsFromRedis(
          this.user,
          this.currentSessionID
        )
        this.rclient.smembers.callCount.should.equal(1)
        this.rclient.del.callCount.should.equal(0)
        this.rclient.srem.callCount.should.equal(0)
      })
    })
  })

  describe('touch', function () {
    it('should not produce an error', async function () {
      await this.UserSessionsManager.promises.touch(this.user)
    })

    it('should call rclient.pexpire', async function () {
      await this.UserSessionsManager.promises.touch(this.user)
      this.rclient.pexpire.callCount.should.equal(1)
    })

    describe('when rclient produces an error', function () {
      beforeEach(function () {
        this.rclient.pexpire.rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises.touch(this.user)
        ).to.be.rejectedWith(Error)
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.touch(null)
      })

      it('should not call pexpire', async function () {
        await this.UserSessionsManager.promises.touch(null)
        this.rclient.pexpire.callCount.should.equal(0)
      })
    })
  })

  describe('getAllUserSessions', function () {
    beforeEach(function () {
      this.sessionKeys = ['sess:one', 'sess:two', 'sess:three']
      this.sessions = [
        '{"user": {"ip_address": "a", "session_created": "b"}}',
        '{"passport": {"user": {"ip_address": "c", "session_created": "d"}}}',
      ]
      this.exclude = ['two']
      this.rclient.smembers.resolves(this.sessionKeys)
      this.rclient.get = sinon.stub()
      this.rclient.get.onCall(0).resolves(this.sessions[0])
      this.rclient.get.onCall(1).resolves(this.sessions[1])
    })

    it('should not produce an error', async function () {
      await this.UserSessionsManager.promises.getAllUserSessions(
        this.user,
        this.exclude
      )
    })

    it('should get sessions', async function () {
      const sessions =
        await this.UserSessionsManager.promises.getAllUserSessions(
          this.user,
          this.exclude
        )
      expect(sessions).to.deep.equal([
        { ip_address: 'a', session_created: 'b' },
        { ip_address: 'c', session_created: 'd' },
      ])
    })

    it('should have called rclient.smembers', async function () {
      await this.UserSessionsManager.promises.getAllUserSessions(
        this.user,
        this.exclude
      )
      this.rclient.smembers.callCount.should.equal(1)
    })

    it('should have called rclient.get', async function () {
      await this.UserSessionsManager.promises.getAllUserSessions(
        this.user,
        this.exclude
      )
      this.rclient.get.callCount.should.equal(this.sessionKeys.length - 1)
    })

    describe('when there are no other sessions', function () {
      beforeEach(function () {
        this.sessionKeys = ['sess:two']
        this.rclient.smembers.resolves(this.sessionKeys)
      })

      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises.getAllUserSessions(
          this.user,
          this.exclude
        )
      })

      it('should produce an empty list of sessions', async function () {
        const sessions =
          await this.UserSessionsManager.promises.getAllUserSessions(
            this.user,
            this.exclude
          )
        expect(sessions).to.deep.equal([])
      })

      it('should have called rclient.smembers', async function () {
        await this.UserSessionsManager.promises.getAllUserSessions(
          this.user,
          this.exclude
        )
        this.rclient.smembers.callCount.should.equal(1)
      })

      it('should not have called rclient.get for individual keys', async function () {
        await this.UserSessionsManager.promises.getAllUserSessions(
          this.user,
          this.exclude
        )
        this.rclient.get.callCount.should.equal(0)
      })
    })

    describe('when smembers produces an error', function () {
      beforeEach(function () {
        this.rclient.smembers.rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises.getAllUserSessions(
            this.user,
            this.exclude
          )
        ).to.be.rejectedWith(Error)
      })

      it('should not have called rclient.get', async function () {
        try {
          await this.UserSessionsManager.promises.getAllUserSessions(
            this.user,
            this.exclude
          )
        } catch (err) {
          // Expected error
        }
        this.rclient.get.callCount.should.equal(0)
      })
    })

    describe('when get produces an error', function () {
      beforeEach(function () {
        this.rclient.get = sinon.stub().rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises.getAllUserSessions(
            this.user,
            this.exclude
          )
        ).to.be.rejectedWith(Error)
      })
    })
  })

  describe('_checkSessions', function () {
    beforeEach(function () {
      this.sessionKeys = ['one', 'two']
      this.rclient.smembers.resolves(this.sessionKeys)
      this.rclient.get.resolves('some-value')
      this.rclient.srem.resolves({})
    })

    it('should not produce an error', async function () {
      await this.UserSessionsManager.promises._checkSessions(this.user)
    })

    it('should call the appropriate redis methods', async function () {
      await this.UserSessionsManager.promises._checkSessions(this.user)
      this.rclient.smembers.callCount.should.equal(1)
      this.rclient.get.callCount.should.equal(2)
      this.rclient.srem.callCount.should.equal(0)
    })

    describe('when one of the keys is not present in redis', function () {
      beforeEach(function () {
        this.rclient.get.onCall(0).resolves('some-val')
        this.rclient.get.onCall(1).resolves(null)
      })

      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises._checkSessions(this.user)
      })

      it('should remove that key from the set', async function () {
        await this.UserSessionsManager.promises._checkSessions(this.user)
        this.rclient.smembers.callCount.should.equal(1)
        this.rclient.get.callCount.should.equal(2)
        this.rclient.srem.callCount.should.equal(1)
        this.rclient.srem.firstCall.args[1].should.equal('two')
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function () {
        await this.UserSessionsManager.promises._checkSessions(null)
      })

      it('should not call redis methods', async function () {
        await this.UserSessionsManager.promises._checkSessions(null)
        this.rclient.smembers.callCount.should.equal(0)
        this.rclient.get.callCount.should.equal(0)
      })
    })

    describe('when one of the get operations produces an error', function () {
      beforeEach(function () {
        this.rclient.get.onCall(0).rejects(new Error('woops'))
        this.rclient.get.onCall(1).resolves(null)
      })

      it('should produce an error', async function () {
        await expect(
          this.UserSessionsManager.promises._checkSessions(this.user)
        ).to.be.rejectedWith(Error)
      })

      it('should call the right redis methods, bailing out early', async function () {
        try {
          await this.UserSessionsManager.promises._checkSessions(this.user)
        } catch (err) {
          // Expected error
        }
        this.rclient.smembers.callCount.should.equal(1)
        this.rclient.get.callCount.should.equal(1)
        this.rclient.srem.callCount.should.equal(0)
      })
    })
  })
})
