import { vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'

const assertCalledWith = sinon.assert.calledWith
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipsHandler'

const { ObjectId } = mongodb

describe('UserMembershipsHandler', function () {
  beforeEach(async function (ctx) {
    ctx.user = { _id: new ObjectId() }

    ctx.Institution = { updateMany: sinon.stub().resolves(null) }
    ctx.Subscription = { updateMany: sinon.stub().resolves(null) }
    ctx.Publisher = { updateMany: sinon.stub().resolves(null) }

    vi.doMock('../../../../app/src/models/Institution', () => ({
      Institution: ctx.Institution,
    }))

    vi.doMock('../../../../app/src/models/Subscription', () => ({
      Subscription: ctx.Subscription,
    }))

    vi.doMock('../../../../app/src/models/Publisher', () => ({
      Publisher: ctx.Publisher,
    }))

    ctx.UserMembershipsHandler = (await import(modulePath)).default
  })

  describe('remove user', function () {
    it('remove user from all entities', async function (ctx) {
      await ctx.UserMembershipsHandler.promises.removeUserFromAllEntities(
        ctx.user._id
      )

      assertCalledWith(
        ctx.Institution.updateMany,
        {},
        { $pull: { managerIds: ctx.user._id } }
      )
      assertCalledWith(
        ctx.Subscription.updateMany,
        {},
        { $pull: { manager_ids: ctx.user._id } }
      )
      assertCalledWith(
        ctx.Publisher.updateMany,
        {},
        { $pull: { managerIds: ctx.user._id } }
      )
    })
  })
})
