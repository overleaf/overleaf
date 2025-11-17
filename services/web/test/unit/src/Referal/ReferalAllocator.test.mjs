import { vi } from 'vitest'
import sinon from 'sinon'

const modulePath = '../../../../app/src/Features/Referal/ReferalAllocator.mjs'

describe('ReferalAllocator', function () {
  beforeEach(async function (ctx) {
    vi.doMock('../../../../app/src/models/User.mjs', () => ({
      User: (ctx.User = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/FeaturesUpdater.mjs',
      () => ({
        default: (ctx.FeaturesUpdater = {}),
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {}),
    }))

    ctx.ReferalAllocator = (await import(modulePath)).default
    ctx.referal_id = 'referal-id-123'
    ctx.referal_medium = 'twitter'
    ctx.user_id = 'user-id-123'
    ctx.new_user_id = 'new-user-id-123'
    ctx.FeaturesUpdater.promises = {
      refreshFeatures: sinon.stub().resolves(),
    }
    ctx.User.updateOne = sinon.stub().returns({
      exec: sinon.stub().resolves(),
    })
    ctx.User.findOne = sinon.stub().returns({
      exec: sinon.stub().resolves({ _id: ctx.user_id }),
    })
  })

  describe('allocate', function () {
    describe('when the referal was a bonus referal', function () {
      beforeEach(async function (ctx) {
        ctx.referal_source = 'bonus'
        await ctx.ReferalAllocator.promises.allocate(
          ctx.referal_id,
          ctx.new_user_id,
          ctx.referal_source,
          ctx.referal_medium
        )
      })

      it('should update the referring user with the refered users id', function (ctx) {
        ctx.User.updateOne
          .calledWith(
            {
              referal_id: ctx.referal_id,
            },
            {
              $push: {
                refered_users: ctx.new_user_id,
              },
              $inc: {
                refered_user_count: 1,
              },
            }
          )
          .should.equal(true)
      })

      it('find the referring users id', function (ctx) {
        ctx.User.findOne
          .calledWith({ referal_id: ctx.referal_id })
          .should.equal(true)
      })

      it("should refresh the user's subscription", function (ctx) {
        ctx.FeaturesUpdater.promises.refreshFeatures
          .calledWith(ctx.user_id)
          .should.equal(true)
      })
    })

    describe('when there is no user for the referal id', function () {
      beforeEach(async function (ctx) {
        ctx.referal_source = 'bonus'
        ctx.referal_id = 'wombat'
        ctx.User.findOne = sinon.stub().returns({
          exec: sinon.stub().resolves(null),
        })
        await ctx.ReferalAllocator.promises.allocate(
          ctx.referal_id,
          ctx.new_user_id,
          ctx.referal_source,
          ctx.referal_medium
        )
      })

      it('should find the referring users id', function (ctx) {
        ctx.User.findOne
          .calledWith({ referal_id: ctx.referal_id })
          .should.equal(true)
      })

      it('should not update the referring user with the refered users id', function (ctx) {
        ctx.User.updateOne.called.should.equal(false)
      })

      it('should not assign the user a bonus', function (ctx) {
        ctx.FeaturesUpdater.promises.refreshFeatures.called.should.equal(false)
      })
    })

    describe('when the referal is not a bonus referal', function () {
      beforeEach(async function (ctx) {
        ctx.referal_source = 'public_share'
        await ctx.ReferalAllocator.promises.allocate(
          ctx.referal_id,
          ctx.new_user_id,
          ctx.referal_source,
          ctx.referal_medium
        )
      })

      it('should not update the referring user with the refered users id', function (ctx) {
        ctx.User.updateOne.called.should.equal(false)
      })

      it('find the referring users id', function (ctx) {
        ctx.User.findOne
          .calledWith({ referal_id: ctx.referal_id })
          .should.equal(true)
      })

      it('should not assign the user a bonus', function (ctx) {
        ctx.FeaturesUpdater.promises.refreshFeatures.called.should.equal(false)
      })
    })
  })
})
