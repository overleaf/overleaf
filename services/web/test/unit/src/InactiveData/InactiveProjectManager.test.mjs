import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb, { ReadPreference } from 'mongodb-legacy'

const { ObjectId } = mongodb

const modulePath =
  '../../../../app/src/Features/InactiveData/InactiveProjectManager'

describe('InactiveProjectManager', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {}
    ctx.metrics = { inc: sinon.stub() }
    ctx.DocstoreManager = {
      promises: {
        unarchiveProject: sinon.stub(),
        archiveProject: sinon.stub(),
      },
    }
    ctx.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongoAndDelete: sinon.stub(),
      },
    }
    ctx.ProjectUpdateHandler = {
      promises: {
        markAsActive: sinon.stub(),
        markAsInactive: sinon.stub(),
      },
    }
    ctx.ProjectGetter = { promises: { getProject: sinon.stub() } }
    ctx.Modules = { promises: { hooks: { fire: sinon.stub() } } }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.metrics,
    }))

    vi.doMock('../../../../app/src/Features/Docstore/DocstoreManager', () => ({
      default: ctx.DocstoreManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectUpdateHandler',
      () => ({
        default: ctx.ProjectUpdateHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({}))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      default: {
        ObjectId,
        READ_PREFERENCE_SECONDARY: ReadPreference.secondaryPreferred.mode,
      },
    }))

    ctx.InactiveProjectManager = (await import(modulePath)).default
    ctx.project_id = '1234'
  })

  describe('reactivateProjectIfRequired', function () {
    beforeEach(function (ctx) {
      ctx.project = { active: false }
      ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
      ctx.ProjectUpdateHandler.promises.markAsActive.resolves()
    })

    it('should call unarchiveProject', async function (ctx) {
      ctx.DocstoreManager.promises.unarchiveProject.resolves()
      await ctx.InactiveProjectManager.promises.reactivateProjectIfRequired(
        ctx.project_id
      )

      ctx.DocstoreManager.promises.unarchiveProject
        .calledWith(ctx.project_id)
        .should.equal(true)
      ctx.ProjectUpdateHandler.promises.markAsActive
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it('should not mark project as active if error with unarchiving', async function (ctx) {
      ctx.DocstoreManager.promises.unarchiveProject.rejects()
      await expect(
        ctx.InactiveProjectManager.promises.reactivateProjectIfRequired(
          ctx.project_id
        )
      ).to.be.rejected

      ctx.DocstoreManager.promises.unarchiveProject
        .calledWith(ctx.project_id)
        .should.equal(true)
      ctx.ProjectUpdateHandler.promises.markAsActive
        .calledWith(ctx.project_id)
        .should.equal(false)
    })

    it('should not call unarchiveProject if it is active', async function (ctx) {
      ctx.project.active = true
      ctx.DocstoreManager.promises.unarchiveProject.resolves()
      await ctx.InactiveProjectManager.promises.reactivateProjectIfRequired(
        ctx.project_id
      )
      ctx.DocstoreManager.promises.unarchiveProject
        .calledWith(ctx.project_id)
        .should.equal(false)
      ctx.ProjectUpdateHandler.promises.markAsActive
        .calledWith(ctx.project_id)
        .should.equal(false)
    })
  })

  describe('deactivateProject', function () {
    it('should call archiveProject and markAsInactive after flushing', async function (ctx) {
      ctx.DocstoreManager.promises.archiveProject.resolves()
      ctx.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete.resolves()
      ctx.ProjectUpdateHandler.promises.markAsInactive.resolves()
      ctx.Modules.promises.hooks.fire.resolves()

      await ctx.InactiveProjectManager.promises.deactivateProject(
        ctx.project_id
      )
      ctx.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete
        .calledWith(ctx.project_id)
        .should.equal(true)
      ctx.Modules.promises.hooks.fire
        .calledWith('deactivateProject', ctx.project_id)
        .should.equal(true)
      ctx.DocstoreManager.promises.archiveProject
        .calledWith(ctx.project_id)
        .should.equal(true)
      ctx.ProjectUpdateHandler.promises.markAsInactive
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it('should not call markAsInactive if there was a problem archiving in docstore', async function (ctx) {
      ctx.DocstoreManager.promises.archiveProject.rejects()
      ctx.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete.resolves()
      ctx.ProjectUpdateHandler.promises.markAsInactive.resolves()
      ctx.Modules.promises.hooks.fire.resolves()

      await expect(
        ctx.InactiveProjectManager.promises.deactivateProject(ctx.project_id)
      ).to.be.rejected
      ctx.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete
        .calledWith(ctx.project_id)
        .should.equal(true)
      ctx.DocstoreManager.promises.archiveProject
        .calledWith(ctx.project_id)
        .should.equal(true)
      ctx.ProjectUpdateHandler.promises.markAsInactive
        .calledWith(ctx.project_id)
        .should.equal(false)
    })
  })
})
