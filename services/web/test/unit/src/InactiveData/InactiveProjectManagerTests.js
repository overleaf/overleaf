const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/InactiveData/InactiveProjectManager'
)
const { ObjectId, ReadPreference } = require('mongodb-legacy')
const { expect } = require('chai')

describe('InactiveProjectManager', function () {
  beforeEach(function () {
    this.settings = {}
    this.metrics = { inc: sinon.stub() }
    this.DocstoreManager = {
      promises: {
        unarchiveProject: sinon.stub(),
        archiveProject: sinon.stub(),
      },
    }
    this.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongoAndDelete: sinon.stub(),
      },
    }
    this.ProjectUpdateHandler = {
      promises: {
        markAsActive: sinon.stub(),
        markAsInactive: sinon.stub(),
      },
    }
    this.ProjectGetter = { promises: { getProject: sinon.stub() } }
    this.Modules = { promises: { hooks: { fire: sinon.stub() } } }
    this.InactiveProjectManager = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '@overleaf/settings': this.settings,
        '@overleaf/metrics': this.metrics,
        '../Docstore/DocstoreManager': this.DocstoreManager,
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../Project/ProjectUpdateHandler': this.ProjectUpdateHandler,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../../models/Project': {},
        '../../infrastructure/Modules': this.Modules,
        '../../infrastructure/mongodb': {
          ObjectId,
          READ_PREFERENCE_SECONDARY: ReadPreference.secondaryPreferred.mode,
        },
      },
    })
    this.project_id = '1234'
  })

  describe('reactivateProjectIfRequired', function () {
    beforeEach(function () {
      this.project = { active: false }
      this.ProjectGetter.promises.getProject.resolves(this.project)
      this.ProjectUpdateHandler.promises.markAsActive.resolves()
    })

    it('should call unarchiveProject', async function () {
      this.DocstoreManager.promises.unarchiveProject.resolves()
      await this.InactiveProjectManager.promises.reactivateProjectIfRequired(
        this.project_id
      )

      this.DocstoreManager.promises.unarchiveProject
        .calledWith(this.project_id)
        .should.equal(true)
      this.ProjectUpdateHandler.promises.markAsActive
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should not mark project as active if error with unarchiving', async function () {
      this.DocstoreManager.promises.unarchiveProject.rejects()
      await expect(
        this.InactiveProjectManager.promises.reactivateProjectIfRequired(
          this.project_id
        )
      ).to.be.rejected

      this.DocstoreManager.promises.unarchiveProject
        .calledWith(this.project_id)
        .should.equal(true)
      this.ProjectUpdateHandler.promises.markAsActive
        .calledWith(this.project_id)
        .should.equal(false)
    })

    it('should not call unarchiveProject if it is active', async function () {
      this.project.active = true
      this.DocstoreManager.promises.unarchiveProject.resolves()
      await this.InactiveProjectManager.promises.reactivateProjectIfRequired(
        this.project_id
      )
      this.DocstoreManager.promises.unarchiveProject
        .calledWith(this.project_id)
        .should.equal(false)
      this.ProjectUpdateHandler.promises.markAsActive
        .calledWith(this.project_id)
        .should.equal(false)
    })
  })

  describe('deactivateProject', function () {
    it('should call archiveProject and markAsInactive after flushing', async function () {
      this.DocstoreManager.promises.archiveProject.resolves()
      this.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete.resolves()
      this.ProjectUpdateHandler.promises.markAsInactive.resolves()
      this.Modules.promises.hooks.fire.resolves()

      await this.InactiveProjectManager.promises.deactivateProject(
        this.project_id
      )
      this.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete
        .calledWith(this.project_id)
        .should.equal(true)
      this.Modules.promises.hooks.fire
        .calledWith('deactivateProject', this.project_id)
        .should.equal(true)
      this.DocstoreManager.promises.archiveProject
        .calledWith(this.project_id)
        .should.equal(true)
      this.ProjectUpdateHandler.promises.markAsInactive
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should not call markAsInactive if there was a problem archiving in docstore', async function () {
      this.DocstoreManager.promises.archiveProject.rejects()
      this.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete.resolves()
      this.ProjectUpdateHandler.promises.markAsInactive.resolves()
      this.Modules.promises.hooks.fire.resolves()

      await expect(
        this.InactiveProjectManager.promises.deactivateProject(this.project_id)
      ).to.be.rejected
      this.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete
        .calledWith(this.project_id)
        .should.equal(true)
      this.DocstoreManager.promises.archiveProject
        .calledWith(this.project_id)
        .should.equal(true)
      this.ProjectUpdateHandler.promises.markAsInactive
        .calledWith(this.project_id)
        .should.equal(false)
    })
  })
})
