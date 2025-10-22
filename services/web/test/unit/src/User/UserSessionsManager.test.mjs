import { vi, expect } from 'vitest'
import sinon from 'sinon'

const modulePath = '../../../../app/src/Features/User/UserSessionsManager.mjs'

describe('UserSessionsManager', function () {
  beforeEach(async function (ctx) {
    ctx.user = {
      _id: 'abcd',
      email: 'user@example.com',
    }
    ctx.sessionId = 'some_session_id'

    ctx.rclient = {
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
    ctx.rclient.multi.returns({
      sadd: sinon.stub().returnsThis(),
      srem: sinon.stub().returnsThis(),
      pexpire: sinon.stub().returnsThis(),
      exec: sinon.stub().resolves(),
    })
    ctx.rclient.get.resolves()
    ctx.rclient.del.resolves()
    ctx.rclient.sadd.resolves()
    ctx.rclient.srem.resolves()
    ctx.rclient.smembers.resolves([])
    ctx.rclient.pexpire.resolves()

    ctx.UserSessionsRedis = {
      client: () => ctx.rclient,
      sessionSetKey: user => `UserSessions:{${user._id}}`,
    }
    ctx.settings = {
      redis: {
        web: {},
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/Features/User/UserSessionsRedis', () => ({
      default: ctx.UserSessionsRedis,
    }))

    return (ctx.UserSessionsManager = (await import(modulePath)).default)
  })

  describe('_sessionKey', function () {
    it('should build the correct key', function (ctx) {
      const result = ctx.UserSessionsManager._sessionKey(ctx.sessionId)
      return result.should.equal('sess:some_session_id')
    })
  })

  describe('trackSession', function () {
    beforeEach(function (ctx) {
      ctx._checkSessions = sinon
        .stub(ctx.UserSessionsManager.promises, '_checkSessions')
        .resolves()
    })

    afterEach(function (ctx) {
      return ctx._checkSessions.restore()
    })

    it('should not produce an error', async function (ctx) {
      await ctx.UserSessionsManager.promises.trackSession(
        ctx.user,
        ctx.sessionId
      )
    })

    it('should call the appropriate redis methods', async function (ctx) {
      await ctx.UserSessionsManager.promises.trackSession(
        ctx.user,
        ctx.sessionId
      )
      ctx.rclient.multi.callCount.should.equal(1)
      const multiInstance = ctx.rclient.multi.returnValues[0]
      multiInstance.sadd.callCount.should.equal(1)
      multiInstance.pexpire.callCount.should.equal(1)
      multiInstance.exec.callCount.should.equal(1)
    })

    it('should call _checkSessions', async function (ctx) {
      await ctx.UserSessionsManager.promises.trackSession(
        ctx.user,
        ctx.sessionId
      )
      ctx._checkSessions.callCount.should.equal(1)
    })

    describe('when rclient produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rclient.multi.returns({
          sadd: sinon.stub().returnsThis(),
          pexpire: sinon.stub().returnsThis(),
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises.trackSession(ctx.user, ctx.sessionId)
        ).to.be.rejectedWith(Error)
      })

      it('should not call _checkSessions', async function (ctx) {
        try {
          await ctx.UserSessionsManager.promises.trackSession(
            ctx.user,
            ctx.sessionId
          )
        } catch (err) {
          // Expected error
        }
        ctx._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.trackSession(null, ctx.sessionId)
      })

      it('should not call the appropriate redis methods', async function (ctx) {
        await ctx.UserSessionsManager.promises.trackSession(null, ctx.sessionId)
        ctx.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function (ctx) {
        await ctx.UserSessionsManager.promises.trackSession(null, ctx.sessionId)
        ctx._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no sessionId is supplied', function () {
      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.trackSession(ctx.user, null)
      })

      it('should not call the appropriate redis methods', async function (ctx) {
        await ctx.UserSessionsManager.promises.trackSession(ctx.user, null)
        ctx.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function (ctx) {
        await ctx.UserSessionsManager.promises.trackSession(ctx.user, null)
        ctx._checkSessions.callCount.should.equal(0)
      })
    })
  })

  describe('untrackSession', function () {
    beforeEach(function (ctx) {
      ctx._checkSessions = sinon
        .stub(ctx.UserSessionsManager.promises, '_checkSessions')
        .resolves()
    })

    afterEach(function (ctx) {
      return ctx._checkSessions.restore()
    })

    it('should not produce an error', async function (ctx) {
      await ctx.UserSessionsManager.promises.untrackSession(
        ctx.user,
        ctx.sessionId
      )
    })

    it('should call the appropriate redis methods', async function (ctx) {
      await ctx.UserSessionsManager.promises.untrackSession(
        ctx.user,
        ctx.sessionId
      )
      ctx.rclient.multi.callCount.should.equal(1)
      const multiInstance = ctx.rclient.multi.returnValues[0]
      multiInstance.srem.callCount.should.equal(1)
      multiInstance.pexpire.callCount.should.equal(1)
      multiInstance.exec.callCount.should.equal(1)
    })

    it('should call _checkSessions', async function (ctx) {
      await ctx.UserSessionsManager.promises.untrackSession(
        ctx.user,
        ctx.sessionId
      )
      ctx._checkSessions.callCount.should.equal(1)
    })

    describe('when rclient produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rclient.multi.returns({
          srem: sinon.stub().returnsThis(),
          pexpire: sinon.stub().returnsThis(),
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises.untrackSession(
            ctx.user,
            ctx.sessionId
          )
        ).to.be.rejectedWith(Error)
      })

      it('should not call _checkSessions', async function (ctx) {
        try {
          await ctx.UserSessionsManager.promises.untrackSession(
            ctx.user,
            ctx.sessionId
          )
        } catch (err) {
          // Expected error
        }
        ctx._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.untrackSession(
          null,
          ctx.sessionId
        )
      })

      it('should not call the appropriate redis methods', async function (ctx) {
        await ctx.UserSessionsManager.promises.untrackSession(
          null,
          ctx.sessionId
        )
        ctx.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function (ctx) {
        await ctx.UserSessionsManager.promises.untrackSession(
          null,
          ctx.sessionId
        )
        ctx._checkSessions.callCount.should.equal(0)
      })
    })

    describe('when no sessionId is supplied', function () {
      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.untrackSession(ctx.user, null)
      })

      it('should not call the appropriate redis methods', async function (ctx) {
        await ctx.UserSessionsManager.promises.untrackSession(ctx.user, null)
        ctx.rclient.multi.callCount.should.equal(0)
      })

      it('should not call _checkSessions', async function (ctx) {
        await ctx.UserSessionsManager.promises.untrackSession(ctx.user, null)
        ctx._checkSessions.callCount.should.equal(0)
      })
    })
  })

  describe('removeSessionsFromRedis', function () {
    beforeEach(function (ctx) {
      ctx.sessionKeys = ['sess:one', 'sess:two']
      ctx.currentSessionID = undefined
      ctx.rclient.smembers.resolves(ctx.sessionKeys)
      ctx.rclient.del.resolves()
      ctx.rclient.srem.resolves()
    })

    it('should not produce an error', async function (ctx) {
      await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
        ctx.user,
        ctx.currentSessionID
      )
    })

    it('should yield the number of purged sessions', async function (ctx) {
      const result =
        await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
          ctx.user,
          ctx.currentSessionID
        )
      expect(result).to.equal(ctx.sessionKeys.length)
    })

    it('should call the appropriate redis methods', async function (ctx) {
      await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
        ctx.user,
        ctx.currentSessionID
      )
      ctx.rclient.smembers.callCount.should.equal(1)

      ctx.rclient.del.callCount.should.equal(2)
      expect(ctx.rclient.del.firstCall.args[0]).to.deep.equal(
        ctx.sessionKeys[0]
      )
      expect(ctx.rclient.del.secondCall.args[0]).to.deep.equal(
        ctx.sessionKeys[1]
      )

      ctx.rclient.srem.callCount.should.equal(1)
      expect(ctx.rclient.srem.firstCall.args[0]).to.deep.equal(
        'UserSessions:{abcd}'
      )
      expect(ctx.rclient.srem.firstCall.args[1]).to.deep.equal(ctx.sessionKeys)
    })

    describe('when a session is retained', function () {
      beforeEach(function (ctx) {
        ctx.sessionKeys = ['sess:one', 'sess:two', 'sess:three', 'sess:four']
        ctx.currentSessionID = 'two'
        ctx.rclient.smembers.resolves(ctx.sessionKeys)
        ctx.rclient.del.resolves()
      })

      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
          ctx.user,
          ctx.currentSessionID
        )
      })

      it('should call the appropriate redis methods', async function (ctx) {
        await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
          ctx.user,
          ctx.currentSessionID
        )
        ctx.rclient.smembers.callCount.should.equal(1)
        ctx.rclient.del.callCount.should.equal(ctx.sessionKeys.length - 1)
        ctx.rclient.srem.callCount.should.equal(1)
      })

      it('should remove all sessions except for the retained one', async function (ctx) {
        await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
          ctx.user,
          ctx.currentSessionID
        )
        expect(ctx.rclient.del.firstCall.args[0]).to.deep.equal('sess:one')
        expect(ctx.rclient.del.secondCall.args[0]).to.deep.equal('sess:three')
        expect(ctx.rclient.del.thirdCall.args[0]).to.deep.equal('sess:four')
        expect(ctx.rclient.srem.firstCall.args[1]).to.deep.equal([
          'sess:one',
          'sess:three',
          'sess:four',
        ])
      })
    })

    describe('when rclient produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rclient.del.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises.removeSessionsFromRedis(
            ctx.user,
            ctx.currentSessionID
          )
        ).to.be.rejectedWith(Error)
      })

      it('should not call rclient.srem', async function (ctx) {
        try {
          await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
            ctx.user,
            ctx.currentSessionID
          )
        } catch (err) {
          // Expected error
        }
        ctx.rclient.srem.callCount.should.equal(0)
      })
    })

    describe('when no user is supplied', function () {
      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises.removeSessionsFromRedis(
            null,
            ctx.currentSessionID
          )
        ).to.be.rejectedWith(/bug: user not passed to removeSessionsFromRedis/)
      })

      it('should not call the appropriate redis methods', async function (ctx) {
        try {
          await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
            null,
            ctx.currentSessionID
          )
        } catch (err) {
          // Expected error
        }
        ctx.rclient.smembers.callCount.should.equal(0)
        ctx.rclient.del.callCount.should.equal(0)
        ctx.rclient.srem.callCount.should.equal(0)
      })
    })

    describe('when there are no keys to delete', function () {
      beforeEach(function (ctx) {
        ctx.rclient.smembers.resolves([])
      })

      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
          ctx.user,
          ctx.currentSessionID
        )
      })

      it('should not do the delete operation', async function (ctx) {
        await ctx.UserSessionsManager.promises.removeSessionsFromRedis(
          ctx.user,
          ctx.currentSessionID
        )
        ctx.rclient.smembers.callCount.should.equal(1)
        ctx.rclient.del.callCount.should.equal(0)
        ctx.rclient.srem.callCount.should.equal(0)
      })
    })
  })

  describe('touch', function () {
    it('should not produce an error', async function (ctx) {
      await ctx.UserSessionsManager.promises.touch(ctx.user)
    })

    it('should call rclient.pexpire', async function (ctx) {
      await ctx.UserSessionsManager.promises.touch(ctx.user)
      ctx.rclient.pexpire.callCount.should.equal(1)
    })

    describe('when rclient produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rclient.pexpire.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises.touch(ctx.user)
        ).to.be.rejectedWith(Error)
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.touch(null)
      })

      it('should not call pexpire', async function (ctx) {
        await ctx.UserSessionsManager.promises.touch(null)
        ctx.rclient.pexpire.callCount.should.equal(0)
      })
    })
  })

  describe('getAllUserSessions', function () {
    beforeEach(function (ctx) {
      ctx.sessionKeys = ['sess:one', 'sess:two', 'sess:three']
      ctx.sessions = [
        '{"user": {"ip_address": "a", "session_created": "b"}}',
        '{"passport": {"user": {"ip_address": "c", "session_created": "d"}}}',
      ]
      ctx.exclude = ['two']
      ctx.rclient.smembers.resolves(ctx.sessionKeys)
      ctx.rclient.get = sinon.stub()
      ctx.rclient.get.onCall(0).resolves(ctx.sessions[0])
      ctx.rclient.get.onCall(1).resolves(ctx.sessions[1])
    })

    it('should not produce an error', async function (ctx) {
      await ctx.UserSessionsManager.promises.getAllUserSessions(
        ctx.user,
        ctx.exclude
      )
    })

    it('should get sessions', async function (ctx) {
      const sessions =
        await ctx.UserSessionsManager.promises.getAllUserSessions(
          ctx.user,
          ctx.exclude
        )
      expect(sessions).to.deep.equal([
        { ip_address: 'a', session_created: 'b' },
        { ip_address: 'c', session_created: 'd' },
      ])
    })

    it('should have called rclient.smembers', async function (ctx) {
      await ctx.UserSessionsManager.promises.getAllUserSessions(
        ctx.user,
        ctx.exclude
      )
      ctx.rclient.smembers.callCount.should.equal(1)
    })

    it('should have called rclient.get', async function (ctx) {
      await ctx.UserSessionsManager.promises.getAllUserSessions(
        ctx.user,
        ctx.exclude
      )
      ctx.rclient.get.callCount.should.equal(ctx.sessionKeys.length - 1)
    })

    describe('when there are no other sessions', function () {
      beforeEach(function (ctx) {
        ctx.sessionKeys = ['sess:two']
        ctx.rclient.smembers.resolves(ctx.sessionKeys)
      })

      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises.getAllUserSessions(
          ctx.user,
          ctx.exclude
        )
      })

      it('should produce an empty list of sessions', async function (ctx) {
        const sessions =
          await ctx.UserSessionsManager.promises.getAllUserSessions(
            ctx.user,
            ctx.exclude
          )
        expect(sessions).to.deep.equal([])
      })

      it('should have called rclient.smembers', async function (ctx) {
        await ctx.UserSessionsManager.promises.getAllUserSessions(
          ctx.user,
          ctx.exclude
        )
        ctx.rclient.smembers.callCount.should.equal(1)
      })

      it('should not have called rclient.get for individual keys', async function (ctx) {
        await ctx.UserSessionsManager.promises.getAllUserSessions(
          ctx.user,
          ctx.exclude
        )
        ctx.rclient.get.callCount.should.equal(0)
      })
    })

    describe('when smembers produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rclient.smembers.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises.getAllUserSessions(
            ctx.user,
            ctx.exclude
          )
        ).to.be.rejectedWith(Error)
      })

      it('should not have called rclient.get', async function (ctx) {
        try {
          await ctx.UserSessionsManager.promises.getAllUserSessions(
            ctx.user,
            ctx.exclude
          )
        } catch (err) {
          // Expected error
        }
        ctx.rclient.get.callCount.should.equal(0)
      })
    })

    describe('when get produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rclient.get = sinon.stub().rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises.getAllUserSessions(
            ctx.user,
            ctx.exclude
          )
        ).to.be.rejectedWith(Error)
      })
    })
  })

  describe('_checkSessions', function () {
    beforeEach(function (ctx) {
      ctx.sessionKeys = ['one', 'two']
      ctx.rclient.smembers.resolves(ctx.sessionKeys)
      ctx.rclient.get.resolves('some-value')
      ctx.rclient.srem.resolves({})
    })

    it('should not produce an error', async function (ctx) {
      await ctx.UserSessionsManager.promises._checkSessions(ctx.user)
    })

    it('should call the appropriate redis methods', async function (ctx) {
      await ctx.UserSessionsManager.promises._checkSessions(ctx.user)
      ctx.rclient.smembers.callCount.should.equal(1)
      ctx.rclient.get.callCount.should.equal(2)
      ctx.rclient.srem.callCount.should.equal(0)
    })

    describe('when one of the keys is not present in redis', function () {
      beforeEach(function (ctx) {
        ctx.rclient.get.onCall(0).resolves('some-val')
        ctx.rclient.get.onCall(1).resolves(null)
      })

      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises._checkSessions(ctx.user)
      })

      it('should remove that key from the set', async function (ctx) {
        await ctx.UserSessionsManager.promises._checkSessions(ctx.user)
        ctx.rclient.smembers.callCount.should.equal(1)
        ctx.rclient.get.callCount.should.equal(2)
        ctx.rclient.srem.callCount.should.equal(1)
        ctx.rclient.srem.firstCall.args[1].should.equal('two')
      })
    })

    describe('when no user is supplied', function () {
      it('should not produce an error', async function (ctx) {
        await ctx.UserSessionsManager.promises._checkSessions(null)
      })

      it('should not call redis methods', async function (ctx) {
        await ctx.UserSessionsManager.promises._checkSessions(null)
        ctx.rclient.smembers.callCount.should.equal(0)
        ctx.rclient.get.callCount.should.equal(0)
      })
    })

    describe('when one of the get operations produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rclient.get.onCall(0).rejects(new Error('woops'))
        ctx.rclient.get.onCall(1).resolves(null)
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.UserSessionsManager.promises._checkSessions(ctx.user)
        ).to.be.rejectedWith(Error)
      })

      it('should call the right redis methods, bailing out early', async function (ctx) {
        try {
          await ctx.UserSessionsManager.promises._checkSessions(ctx.user)
        } catch (err) {
          // Expected error
        }
        ctx.rclient.smembers.callCount.should.equal(1)
        ctx.rclient.get.callCount.should.equal(1)
        ctx.rclient.srem.callCount.should.equal(0)
      })
    })
  })
})
