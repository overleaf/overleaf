import { vi, expect } from 'vitest'
import sinon from 'sinon'

const SCRIPT_PATH = '../../../../scripts/oauth/notify_expiring_tokens.mjs'

describe('notify_expiring_tokens', function () {
  beforeEach(async function (ctx) {
    ctx.userEmail = 'user@example.com'

    ctx.User = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves({ email: ctx.userEmail }),
      }),
    }

    ctx.collection = {
      cursor: [],
      find: sinon.stub().callsFake(() => ({
        [Symbol.asyncIterator]: async function* () {
          for (const t of ctx.collection.cursor) yield t
        },
      })),
      updateOne: sinon.stub().resolves({ modifiedCount: 1 }),
    }

    ctx.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/infrastructure/mongodb.mjs', () => ({
      db: { oauthAccessTokens: ctx.collection },
      READ_PREFERENCE_SECONDARY: 'secondary',
    }))

    vi.doMock('../../../../app/src/models/User.mjs', () => ({
      User: ctx.User,
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler.mjs', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        personalAccessTokens: { expiry: { warningWindowDays: 2 } },
      },
    }))

    vi.doMock('../../../../scripts/lib/ScriptRunner.mjs', () => ({
      scriptRunner: async fn => fn(),
    }))

    ctx.script = await import(SCRIPT_PATH)
  })

  describe('notifyOwner', function () {
    it('returns true and sets lastNotifiedAt on successful send', async function (ctx) {
      const token = {
        _id: 'tok-1',
        user_id: 'user-1',
        accessTokenExpiresAt: new Date('2026-05-20T00:00:00Z'),
      }
      const ok = await ctx.script.notifyOwner({
        token,
        kind: 'warning',
        template: 'gitTokenExpiringSoon',
      })
      expect(ok).to.equal(true)
      expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'gitTokenExpiringSoon',
        sinon.match({ to: ctx.userEmail })
      )
      expect(ctx.collection.updateOne).to.have.been.calledOnce
      const update = ctx.collection.updateOne.firstCall.args[1]
      expect(update.$set).to.have.property('lastNotifiedAt.warning')
    })

    it('returns false and does NOT set the marker if EmailHandler rejects', async function (ctx) {
      ctx.EmailHandler.promises.sendEmail.rejects(new Error('SMTP down'))
      const token = {
        _id: 'tok-2',
        user_id: 'user-2',
        accessTokenExpiresAt: new Date('2026-05-20T00:00:00Z'),
      }
      const ok = await ctx.script.notifyOwner({
        token,
        kind: 'expired',
        template: 'gitTokenExpired',
      })
      expect(ok).to.equal(false)
      expect(ctx.collection.updateOne).to.not.have.been.called
    })

    it('returns false and skips when the owner has no email', async function (ctx) {
      ctx.User.findOne.returns({
        exec: sinon.stub().resolves(null),
      })
      const token = {
        _id: 'tok-3',
        user_id: 'user-3',
        accessTokenExpiresAt: new Date('2026-05-20T00:00:00Z'),
      }
      const ok = await ctx.script.notifyOwner({
        token,
        kind: 'warning',
        template: 'gitTokenExpiringSoon',
      })
      expect(ok).to.equal(false)
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
      expect(ctx.collection.updateOne).to.not.have.been.called
    })
  })

  describe('processBucket', function () {
    it('iterates all matching tokens and counts successful sends', async function (ctx) {
      ctx.collection.cursor = [
        {
          _id: 't1',
          user_id: 'u1',
          accessTokenExpiresAt: new Date('2026-05-20T00:00:00Z'),
        },
        {
          _id: 't2',
          user_id: 'u2',
          accessTokenExpiresAt: new Date('2026-05-21T00:00:00Z'),
        },
      ]
      const count = await ctx.script.processBucket({
        kind: 'warning',
        template: 'gitTokenExpiringSoon',
        query: { type: 'pat' },
      })
      expect(count).to.equal(2)
      expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledTwice
      expect(ctx.collection.updateOne).to.have.been.calledTwice
    })

    it('continues processing remaining tokens after one send fails', async function (ctx) {
      ctx.collection.cursor = [
        {
          _id: 't1',
          user_id: 'u1',
          accessTokenExpiresAt: new Date('2026-05-20T00:00:00Z'),
        },
        {
          _id: 't2',
          user_id: 'u2',
          accessTokenExpiresAt: new Date('2026-05-21T00:00:00Z'),
        },
      ]
      ctx.EmailHandler.promises.sendEmail
        .onFirstCall()
        .rejects(new Error('transient'))
        .onSecondCall()
        .resolves()

      const count = await ctx.script.processBucket({
        kind: 'expired',
        template: 'gitTokenExpired',
        query: { type: 'pat' },
      })
      expect(count).to.equal(1)
      expect(ctx.collection.updateOne).to.have.been.calledOnce
    })

    it('returns 0 when no tokens match', async function (ctx) {
      ctx.collection.cursor = []
      const count = await ctx.script.processBucket({
        kind: 'warning',
        template: 'gitTokenExpiringSoon',
        query: { type: 'pat' },
      })
      expect(count).to.equal(0)
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
    })
  })

  describe('main query construction', function () {
    it('queries the warning bucket within the configured window and skips already-warned tokens', async function (ctx) {
      ctx.collection.cursor = []
      await ctx.script.main()

      const warningCall = ctx.collection.find
        .getCalls()
        .find(c => c.args[0]['lastNotifiedAt.warning'])
      expect(warningCall).to.exist
      const q = warningCall.args[0]
      expect(q.type).to.equal('pat')
      expect(q['lastNotifiedAt.warning']).to.deep.equal({ $exists: false })
      expect(q.accessTokenExpiresAt.$gt).to.be.instanceOf(Date)
      expect(q.accessTokenExpiresAt.$lte).to.be.instanceOf(Date)
      const horizonMs =
        q.accessTokenExpiresAt.$lte.getTime() -
        q.accessTokenExpiresAt.$gt.getTime()
      expect(horizonMs).to.equal(2 * 24 * 60 * 60 * 1000)
    })

    it('queries the expired bucket and excludes suppressed tokens', async function (ctx) {
      ctx.collection.cursor = []
      await ctx.script.main()

      const expiredCall = ctx.collection.find
        .getCalls()
        .find(c => c.args[0]['lastNotifiedAt.expired'])
      expect(expiredCall).to.exist
      const q = expiredCall.args[0]
      expect(q['lastNotifiedAt.expired']).to.deep.equal({ $exists: false })
      expect(q.notificationsSuppressedAt).to.deep.equal({ $exists: false })
    })
  })
})
