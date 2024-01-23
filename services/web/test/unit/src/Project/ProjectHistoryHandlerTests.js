/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert, expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Project/ProjectHistoryHandler'
const SandboxedModule = require('sandboxed-module')

describe('ProjectHistoryHandler', function () {
  const projectId = '4eecb1c1bffa66588e0000a1'
  const userId = 1234

  beforeEach(function () {
    let Project
    this.ProjectModel = Project = (function () {
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
    this.project = new this.ProjectModel()
    this.historyId = this.project._id.toString()

    this.callback = sinon.stub()

    return (this.ProjectHistoryHandler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.Settings = {}),
        '../../models/Project': {
          Project: this.ProjectModel,
        },
        './ProjectDetailsHandler': (this.ProjectDetailsHandler = {
          promises: {},
        }),
        '../History/HistoryManager': (this.HistoryManager = {
          promises: {},
        }),
        './ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {
          promises: {},
        }),
      },
    }))
  })

  describe('starting history for an existing project', function () {
    beforeEach(async function () {
      this.HistoryManager.promises.initializeProject = sinon
        .stub()
        .resolves(this.historyId)
      this.HistoryManager.promises.flushProject = sinon.stub()

      return (this.ProjectEntityUpdateHandler.promises.resyncProjectHistory =
        sinon.stub())
    })

    describe('when the history does not already exist', function () {
      beforeEach(async function () {
        this.ProjectDetailsHandler.promises.getDetails = sinon
          .stub()
          .withArgs(projectId)
          .resolves(this.project)
        this.ProjectModel.updateOne = sinon.stub().resolves({ matchedCount: 1 })
        return this.ProjectHistoryHandler.promises.ensureHistoryExistsForProject(
          projectId
        )
      })

      it('should get any existing history id for the project', async function () {
        return this.ProjectDetailsHandler.promises.getDetails
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should initialize a new history in the v1 history service', async function () {
        return this.HistoryManager.promises.initializeProject.called.should.equal(
          true
        )
      })

      it('should set the new history id on the project', async function () {
        return this.ProjectModel.updateOne
          .calledWith(
            { _id: projectId, 'overleaf.history.id': { $exists: false } },
            { 'overleaf.history.id': this.historyId }
          )
          .should.equal(true)
      })

      it('should resync the project history', async function () {
        return this.ProjectEntityUpdateHandler.promises.resyncProjectHistory
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should flush the project history', async function () {
        return this.HistoryManager.promises.flushProject
          .calledWith(projectId)
          .should.equal(true)
      })
    })

    describe('when the history already exists', function () {
      beforeEach(function () {
        this.project.overleaf = { history: { id: 1234 } }
        this.ProjectDetailsHandler.promises.getDetails = sinon
          .stub()
          .withArgs(projectId)
          .resolves(this.project)
        this.ProjectModel.updateOne = sinon.stub().resolves({ matchedCount: 1 })
        return this.ProjectHistoryHandler.promises.ensureHistoryExistsForProject(
          projectId
        )
      })

      it('should get any existing history id for the project', async function () {
        return this.ProjectDetailsHandler.promises.getDetails
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should not initialize a new history in the v1 history service', async function () {
        return this.HistoryManager.promises.initializeProject.called.should.equal(
          false
        )
      })

      it('should not set the new history id on the project', async function () {
        return this.ProjectModel.updateOne.called.should.equal(false)
      })

      it('should not resync the project history', async function () {
        return this.ProjectEntityUpdateHandler.promises.resyncProjectHistory.called.should.equal(
          false
        )
      })

      it('should not flush the project history', async function () {
        return this.HistoryManager.promises.flushProject.called.should.equal(
          false
        )
      })
    })
  })
})
