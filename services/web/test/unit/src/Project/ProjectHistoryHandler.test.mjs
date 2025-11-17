import { vi } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/Project/ProjectHistoryHandler.mjs'

describe('ProjectHistoryHandler', function () {
  const projectId = '4eecb1c1bffa66588e0000a1'

  beforeEach(async function (ctx) {
    let Project
    ctx.ProjectModel = Project = (function () {
      Project = class Project {
        static initClass() {
          this.prototype.rootFolder = [this.rootFolder]
        }

        constructor(options) {
          this._id = projectId
          this.name = 'project_name_here'
          this.rev = 0
        }
      }
      Project.initClass()
      return Project
    })()
    ctx.project = new ctx.ProjectModel()
    ctx.historyId = ctx.project._id.toString()

    ctx.callback = sinon.stub()

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {}),
    }))

    vi.doMock('../../../../app/src/models/Project.mjs', () => ({
      Project: ctx.ProjectModel,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler.mjs',
      () => ({
        default: (ctx.ProjectDetailsHandler = {
          promises: {},
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/History/HistoryManager.mjs',
      () => ({
        default: (ctx.HistoryManager = {
          promises: {},
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler',
      () => ({
        default: (ctx.ProjectEntityUpdateHandler = {
          promises: {},
        }),
      })
    )

    return (ctx.ProjectHistoryHandler = (await import(modulePath)).default)
  })

  describe('starting history for an existing project', function () {
    beforeEach(async function (ctx) {
      ctx.HistoryManager.promises.initializeProject = sinon
        .stub()
        .resolves(ctx.historyId)
      ctx.HistoryManager.promises.flushProject = sinon.stub()

      return (ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory =
        sinon.stub())
    })

    describe('when the history does not already exist', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectDetailsHandler.promises.getDetails = sinon
          .stub()
          .withArgs(projectId)
          .resolves(ctx.project)
        ctx.ProjectModel.updateOne = sinon.stub().resolves({ matchedCount: 1 })
        return ctx.ProjectHistoryHandler.promises.ensureHistoryExistsForProject(
          projectId
        )
      })

      it('should get any existing history id for the project', async function (ctx) {
        return ctx.ProjectDetailsHandler.promises.getDetails
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should initialize a new history in the v1 history service', async function (ctx) {
        return ctx.HistoryManager.promises.initializeProject.called.should.equal(
          true
        )
      })

      it('should set the new history id on the project', async function (ctx) {
        return ctx.ProjectModel.updateOne
          .calledWith(
            { _id: projectId, 'overleaf.history.id': { $exists: false } },
            { 'overleaf.history.id': ctx.historyId }
          )
          .should.equal(true)
      })

      it('should resync the project history', async function (ctx) {
        return ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should flush the project history', async function (ctx) {
        return ctx.HistoryManager.promises.flushProject
          .calledWith(projectId)
          .should.equal(true)
      })
    })

    describe('when the history already exists', function () {
      beforeEach(function (ctx) {
        ctx.project.overleaf = { history: { id: 1234 } }
        ctx.ProjectDetailsHandler.promises.getDetails = sinon
          .stub()
          .withArgs(projectId)
          .resolves(ctx.project)
        ctx.ProjectModel.updateOne = sinon.stub().resolves({ matchedCount: 1 })
        return ctx.ProjectHistoryHandler.promises.ensureHistoryExistsForProject(
          projectId
        )
      })

      it('should get any existing history id for the project', async function (ctx) {
        return ctx.ProjectDetailsHandler.promises.getDetails
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should not initialize a new history in the v1 history service', async function (ctx) {
        return ctx.HistoryManager.promises.initializeProject.called.should.equal(
          false
        )
      })

      it('should not set the new history id on the project', async function (ctx) {
        return ctx.ProjectModel.updateOne.called.should.equal(false)
      })

      it('should not resync the project history', async function (ctx) {
        return ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory.called.should.equal(
          false
        )
      })

      it('should not flush the project history', async function (ctx) {
        return ctx.HistoryManager.promises.flushProject.called.should.equal(
          false
        )
      })
    })
  })
})
