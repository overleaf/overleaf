import { vi, expect } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Publishers/PublishersGetter.mjs'
)

describe('PublishersGetter', function () {
  beforeEach(async function (ctx) {
    ctx.publisher = {
      _id: 'mock-publsiher-id',
      slug: 'ieee',
      fetchV1Data: sinon.stub(),
    }

    ctx.UserMembershipsHandler = {
      promises: {
        getEntitiesByUser: sinon.stub().resolves([ctx.publisher]),
      },
    }
    ctx.UserMembershipEntityConfigs = {
      publisher: {
        modelName: 'Publisher',
        canCreate: true,
        fields: {
          primaryKey: 'slug',
        },
      },
    }

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipsHandler',
      () => ({
        default: ctx.UserMembershipsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs',
      () => ({
        default: ctx.UserMembershipEntityConfigs,
      })
    )

    ctx.PublishersGetter = (await import(modulePath)).default

    ctx.userId = '12345abcde'
  })

  describe('getManagedPublishers', function () {
    it('fetches v1 data before returning publisher list', async function (ctx) {
      const publishers =
        await ctx.PublishersGetter.promises.getManagedPublishers(ctx.userId)
      expect(publishers.length).to.equal(1)
    })
  })
})
