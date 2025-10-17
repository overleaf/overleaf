import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath = '../../../../app/src/Features/User/UserHandler.mjs'

describe('UserHandler', function () {
  beforeEach(async function (ctx) {
    ctx.user = {
      _id: '12390i',
      email: 'bob@bob.com',
      remove: sinon.stub().callsArgWith(0),
    }

    ctx.TeamInvitesHandler = {
      promises: {
        createTeamInvitesForLegacyInvitedEmail: sinon.stub().resolves(),
      },
    }

    ctx.db = {
      users: {
        countDocuments: sinon.stub().resolves(2),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Subscription/TeamInvitesHandler',
      () => ({
        default: ctx.TeamInvitesHandler,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      db: ctx.db,
      READ_PREFERENCE_SECONDARY: 'read-preference-secondary',
    }))

    ctx.UserHandler = (await import(modulePath)).default
  })

  describe('populateTeamInvites', function () {
    beforeEach(async function (ctx) {
      await ctx.UserHandler.promises.populateTeamInvites(ctx.user)
    })

    it('notifies the user about legacy team invites', function (ctx) {
      ctx.TeamInvitesHandler.promises.createTeamInvitesForLegacyInvitedEmail
        .calledWith(ctx.user.email)
        .should.eq(true)
    })
  })

  describe('countActiveUsers', function () {
    it('return user count from DB lookup', async function (ctx) {
      expect(await ctx.UserHandler.promises.countActiveUsers()).to.equal(2)
    })
  })
})
