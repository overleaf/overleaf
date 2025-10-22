import { vi, expect } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Referal/ReferalFeatures.mjs'
)

describe('ReferalFeatures', function () {
  beforeEach(async function (ctx) {
    vi.doMock('../../../../app/src/models/User', () => ({
      User: (ctx.User = {}),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {}),
    }))

    ctx.ReferalFeatures = (await import(modulePath)).default
    ctx.referal_id = 'referal-id-123'
    ctx.referal_medium = 'twitter'
    ctx.user_id = 'user-id-123'
    ctx.new_user_id = 'new-user-id-123'
  })

  describe('getBonusFeatures', function () {
    beforeEach(async function (ctx) {
      ctx.refered_user_count = 3
      ctx.Settings.bonus_features = {
        3: {
          collaborators: 3,
          dropbox: false,
          versioning: false,
        },
      }
      const stubbedUser = {
        refered_user_count: ctx.refered_user_count,
        features: { collaborators: 1, dropbox: false, versioning: false },
      }

      ctx.User.findOne = sinon.stub().returns({
        exec: sinon.stub().resolves(stubbedUser),
      })
      ctx.features = await ctx.ReferalFeatures.promises.getBonusFeatures(
        ctx.user_id
      )
    })

    it('should get the users number of refered user', function (ctx) {
      ctx.User.findOne.calledWith({ _id: ctx.user_id }).should.equal(true)
    })

    it('should return the features', function (ctx) {
      expect(ctx.features).to.equal(ctx.Settings.bonus_features[3])
    })
  })

  describe('when the user is not at a bonus level', function () {
    beforeEach(async function (ctx) {
      ctx.refered_user_count = 0
      ctx.Settings.bonus_features = {
        1: {
          collaborators: 3,
          dropbox: false,
          versioning: false,
        },
      }
      ctx.User.findOne = sinon.stub().returns({
        exec: sinon
          .stub()
          .resolves({ refered_user_count: ctx.refered_user_count }),
      })

      ctx.features = await ctx.ReferalFeatures.promises.getBonusFeatures(
        ctx.user_id
      )
    })

    it('should get the users number of refered user', function (ctx) {
      ctx.User.findOne.calledWith({ _id: ctx.user_id }).should.equal(true)
    })

    it('should return an empty feature set', function (ctx) {
      expect(ctx.features).to.be.empty
    })
  })
})
