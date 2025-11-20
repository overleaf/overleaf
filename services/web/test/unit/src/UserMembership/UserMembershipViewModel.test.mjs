import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import MongoHelpers from '../../../../app/src/Features/Helpers/Mongo.mjs'

const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled

const { isObjectIdInstance, normalizeQuery } = MongoHelpers
const { ObjectId } = mongodb

const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipViewModel'

describe('UserMembershipViewModel', function () {
  beforeEach(async function (ctx) {
    ctx.UserGetter = { promises: { getUsers: sinon.stub() } }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('../../../../app/src/Features/Helpers/Mongo', () => ({
      default: { isObjectIdInstance, normalizeQuery },
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    ctx.UserMembershipViewModel = (await import(modulePath)).default
    ctx.email = 'mock-email@bar.com'
    ctx.user = {
      _id: 'mock-user-id',
      email: 'mock-email@baz.com',
      first_name: 'Name',
      lastLoggedIn: '2020-05-20T10:41:11.407Z',
      enrollment: {
        managedBy: 'mock-group-id',
        enrolledAt: new Date(),
        sso: {
          groupId: 'abc123abc123',
          linkedAt: new Date(),
          primary: true,
        },
      },
    }
  })

  describe('build', function () {
    it('build email', function (ctx) {
      const viewModel = ctx.UserMembershipViewModel.build(ctx.email)
      expect(viewModel).to.deep.equal({
        email: ctx.email,
        invite: true,
        last_active_at: null,
        last_logged_in_at: null,
        first_name: null,
        last_name: null,
        _id: null,
        enrollment: undefined,
      })
    })

    it('build user', function (ctx) {
      const viewModel = ctx.UserMembershipViewModel.build(ctx.user)
      expect(viewModel).to.deep.equal({
        email: ctx.user.email,
        invite: false,
        last_active_at: ctx.user.lastLoggedIn,
        last_logged_in_at: ctx.user.lastLoggedIn,
        first_name: ctx.user.first_name,
        last_name: null,
        _id: ctx.user._id,
        enrollment: ctx.user.enrollment,
      })
    })
  })

  describe('build async', function () {
    beforeEach(function (ctx) {
      ctx.UserMembershipViewModel.build = sinon.stub()
    })

    it('build email', async function (ctx) {
      ctx.UserGetter.promises.getUsers.resolves([])
      await ctx.UserMembershipViewModel.buildAsync([ctx.email])
      assertCalledWith(ctx.UserMembershipViewModel.build, ctx.email)
    })

    it('build user', async function (ctx) {
      ctx.UserGetter.promises.getUsers.resolves([])
      await ctx.UserMembershipViewModel.buildAsync([ctx.user])
      assertCalledWith(ctx.UserMembershipViewModel.build, ctx.user)
    })

    it('build user id', async function (ctx) {
      const user = {
        ...ctx.user,
        _id: new ObjectId(),
      }
      ctx.UserGetter.promises.getUsers.resolves([user])
      const [viewModel] = await ctx.UserMembershipViewModel.buildAsync([
        user._id,
      ])
      assertNotCalled(ctx.UserMembershipViewModel.build)
      expect(viewModel._id.toString()).to.equal(user._id.toString())
      expect(viewModel.email).to.equal(user.email)
      expect(viewModel.first_name).to.equal(user.first_name)
      expect(viewModel.invite).to.equal(false)
      expect(viewModel.email).to.exist
      expect(viewModel.enrollment).to.exist
      expect(viewModel.enrollment).to.deep.equal(user.enrollment)
    })

    it('build user id with error', async function (ctx) {
      ctx.UserGetter.promises.getUsers.rejects(new Error('nope'))
      const userId = new ObjectId()
      const [viewModel] = await ctx.UserMembershipViewModel.buildAsync([userId])
      assertNotCalled(ctx.UserMembershipViewModel.build)
      expect(viewModel._id).to.equal(userId.toString())
      expect(viewModel.email).not.to.exist
    })
  })
})
