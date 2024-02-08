const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Project/ProjectUpdateHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectUpdateHandler', function () {
  beforeEach(function () {
    this.fakeTime = new Date()
    this.clock = sinon.useFakeTimers(this.fakeTime.getTime())
  })

  afterEach(function () {
    this.clock.restore()
  })

  beforeEach(function () {
    this.ProjectModel = class Project {}
    this.ProjectModel.updateOne = sinon.stub().returns({
      exec: sinon.stub(),
    })
    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/Project': { Project: this.ProjectModel },
      },
    })
  })

  describe('marking a project as recently updated', function () {
    beforeEach(function () {
      this.project_id = 'project_id'
      this.lastUpdatedAt = 987654321
      this.lastUpdatedBy = 'fake-last-updater-id'
    })

    it('should send an update to mongo', async function () {
      await this.handler.promises.markAsUpdated(
        this.project_id,
        this.lastUpdatedAt,
        this.lastUpdatedBy
      )

      sinon.assert.calledWith(
        this.ProjectModel.updateOne,
        {
          _id: this.project_id,
          lastUpdated: { $lt: this.lastUpdatedAt },
        },
        {
          lastUpdated: this.lastUpdatedAt,
          lastUpdatedBy: this.lastUpdatedBy,
        }
      )
    })

    it('should set smart fallbacks', async function () {
      await this.handler.promises.markAsUpdated(this.project_id, null, null)
      sinon.assert.calledWithMatch(
        this.ProjectModel.updateOne,
        {
          _id: this.project_id,
          lastUpdated: { $lt: this.fakeTime },
        },
        {
          lastUpdated: this.fakeTime,
          lastUpdatedBy: null,
        }
      )
    })
  })

  describe('markAsOpened', function () {
    it('should send an update to mongo', async function () {
      const projectId = 'project_id'
      await this.handler.promises.markAsOpened(projectId)
      const args = this.ProjectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      const date = args[1].lastOpened + ''
      const now = Date.now() + ''
      date.substring(0, 5).should.equal(now.substring(0, 5))
    })
  })

  describe('markAsInactive', function () {
    it('should send an update to mongo', async function () {
      const projectId = 'project_id'
      await this.handler.promises.markAsInactive(projectId)
      const args = this.ProjectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].active.should.equal(false)
    })
  })

  describe('markAsActive', function () {
    it('should send an update to mongo', async function () {
      const projectId = 'project_id'
      await this.handler.promises.markAsActive(projectId)
      const args = this.ProjectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].active.should.equal(true)
    })
  })
})
