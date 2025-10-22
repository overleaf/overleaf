import { vi } from 'vitest'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/Project/ProjectUpdateHandler.mjs'

describe('ProjectUpdateHandler', function () {
  beforeEach(function (ctx) {
    ctx.fakeTime = new Date()
    ctx.clock = sinon.useFakeTimers(ctx.fakeTime.getTime())
  })

  afterEach(function (ctx) {
    ctx.clock.restore()
  })

  beforeEach(async function (ctx) {
    ctx.ProjectModel = class Project {}
    ctx.ProjectModel.updateOne = sinon.stub().returns({
      exec: sinon.stub(),
    })

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.ProjectModel,
    }))

    ctx.handler = (await import(modulePath)).default
  })

  describe('marking a project as recently updated', function () {
    beforeEach(function (ctx) {
      ctx.project_id = 'project_id'
      ctx.lastUpdatedAt = 987654321
      ctx.lastUpdatedBy = 'fake-last-updater-id'
    })

    it('should send an update to mongo', async function (ctx) {
      await ctx.handler.promises.markAsUpdated(
        ctx.project_id,
        ctx.lastUpdatedAt,
        ctx.lastUpdatedBy
      )

      sinon.assert.calledWith(
        ctx.ProjectModel.updateOne,
        {
          _id: ctx.project_id,
          lastUpdated: { $lt: ctx.lastUpdatedAt },
        },
        {
          lastUpdated: ctx.lastUpdatedAt,
          lastUpdatedBy: ctx.lastUpdatedBy,
        }
      )
    })

    it('should set smart fallbacks', async function (ctx) {
      await ctx.handler.promises.markAsUpdated(ctx.project_id, null, null)
      sinon.assert.calledWithMatch(
        ctx.ProjectModel.updateOne,
        {
          _id: ctx.project_id,
          lastUpdated: { $lt: ctx.fakeTime },
        },
        {
          lastUpdated: ctx.fakeTime,
          lastUpdatedBy: null,
        }
      )
    })
  })

  describe('markAsOpened', function () {
    it('should send an update to mongo', async function (ctx) {
      const projectId = 'project_id'
      await ctx.handler.promises.markAsOpened(projectId)
      const args = ctx.ProjectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      const date = args[1].lastOpened + ''
      const now = Date.now() + ''
      date.substring(0, 5).should.equal(now.substring(0, 5))
    })
  })

  describe('markAsInactive', function () {
    it('should send an update to mongo', async function (ctx) {
      const projectId = 'project_id'
      await ctx.handler.promises.markAsInactive(projectId)
      const args = ctx.ProjectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].active.should.equal(false)
    })
  })

  describe('markAsActive', function () {
    it('should send an update to mongo', async function (ctx) {
      const projectId = 'project_id'
      await ctx.handler.promises.markAsActive(projectId)
      const args = ctx.ProjectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].active.should.equal(true)
    })
  })
})
