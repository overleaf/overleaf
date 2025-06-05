import { expect, vi } from 'vitest'
import sinon from 'sinon'
const modulePath = '../../../../app/src/Features/Referal/ReferalHandler.mjs'

describe('Referal handler', function () {
  beforeEach(async function (ctx) {
    ctx.User = {
      findById: sinon.stub().returns({
        exec: sinon.stub(),
      }),
    }

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.User,
    }))

    ctx.handler = (await import(modulePath)).default
    ctx.user_id = '12313'
  })

  describe('getting refered user_ids', function () {
    it('should get the user from mongo and return the refered users array', async function (ctx) {
      const user = {
        refered_users: ['1234', '312312', '3213129'],
        refered_user_count: 3,
      }
      ctx.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const {
        referedUsers: passedReferedUserIds,
        referedUserCount: passedReferedUserCount,
      } = await ctx.handler.promises.getReferedUsers(ctx.user_id)

      passedReferedUserIds.should.deep.equal(user.refered_users)
      passedReferedUserCount.should.equal(3)
    })

    it('should return an empty array if it is not set', async function (ctx) {
      const user = {}
      ctx.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const { referedUsers: passedReferedUserIds } =
        await ctx.handler.promises.getReferedUsers(ctx.user_id)

      passedReferedUserIds.length.should.equal(0)
    })

    it('should return a zero count if neither it or the array are set', async function (ctx) {
      const user = {}
      ctx.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const { referedUserCount: passedReferedUserCount } =
        await ctx.handler.promises.getReferedUsers(ctx.user_id)

      passedReferedUserCount.should.equal(0)
    })

    it('should return the array length if count is not set', async function (ctx) {
      const user = { refered_users: ['1234', '312312', '3213129'] }
      ctx.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const { referedUserCount: passedReferedUserCount } =
        await ctx.handler.promises.getReferedUsers(ctx.user_id)

      passedReferedUserCount.should.equal(3)
    })

    it('should error if finding the user fails', async function (ctx) {
      ctx.User.findById.returns({
        exec: sinon.stub().rejects(new Error('user not found')),
      })

      expect(
        ctx.handler.promises.getReferedUsers(ctx.user_id)
      ).to.be.rejectedWith('user not found')
    })
  })
})
