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
    this.DocstoreManager = {
      promises: {
        unarchiveProject: sinon.stub(),
        archiveProject: sinon.stub(),
      },
    }
    this.ProjectUpdateHandler = {
      promises: {
        markAsActive: sinon.stub(),
        markAsInactive: sinon.stub(),
      },
    }
    this.ProjectGetter = { promises: { getProject: sinon.stub() } }
    this.InactiveProjectManager = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '@overleaf/settings': this.settings,
        '../Docstore/DocstoreManager': this.DocstoreManager,
        '../Project/ProjectUpdateHandler': this.ProjectUpdateHandler,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../../models/Project': {},
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
    it('should call unarchiveProject and markAsInactive', async function () {
      this.DocstoreManager.promises.archiveProject.resolves()
      this.ProjectUpdateHandler.promises.markAsInactive.resolves()

      await this.InactiveProjectManager.promises.deactivateProject(
        this.project_id
      )
      this.DocstoreManager.promises.archiveProject
        .calledWith(this.project_id)
        .should.equal(true)
      this.ProjectUpdateHandler.promises.markAsInactive
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should not call markAsInactive if there was a problem archiving in docstore', async function () {
      this.DocstoreManager.promises.archiveProject.rejects()
      this.ProjectUpdateHandler.promises.markAsInactive.resolves()

      await expect(
        this.InactiveProjectManager.promises.deactivateProject(this.project_id)
      ).to.be.rejected
      this.DocstoreManager.promises.archiveProject
        .calledWith(this.project_id)
        .should.equal(true)
      this.ProjectUpdateHandler.promises.markAsInactive
        .calledWith(this.project_id)
        .should.equal(false)
    })
  })
})
