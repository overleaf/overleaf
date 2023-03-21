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
        './ProjectDetailsHandler': (this.ProjectDetailsHandler = {}),
        '../History/HistoryManager': (this.HistoryManager = {}),
        './ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {}),
      },
    }))
  })

  describe('starting history for an existing project', function () {
    beforeEach(function () {
      this.HistoryManager.initializeProject = sinon
        .stub()
        .yields(null, this.historyId)
      this.HistoryManager.flushProject = sinon.stub().callsArg(1)
      return (this.ProjectEntityUpdateHandler.resyncProjectHistory = sinon
        .stub()
        .callsArg(1))
    })

    describe('when the history does not already exist', function () {
      beforeEach(function () {
        this.ProjectDetailsHandler.getDetails = sinon
          .stub()
          .withArgs(projectId)
          .callsArgWith(1, null, this.project)
        this.ProjectModel.updateOne = sinon
          .stub()
          .callsArgWith(2, null, { matchedCount: 1 })
        return this.ProjectHistoryHandler.ensureHistoryExistsForProject(
          projectId,
          this.callback
        )
      })

      it('should get any existing history id for the project', function () {
        return this.ProjectDetailsHandler.getDetails
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should initialize a new history in the v1 history service', function () {
        return this.HistoryManager.initializeProject.called.should.equal(true)
      })

      it('should set the new history id on the project', function () {
        return this.ProjectModel.updateOne
          .calledWith(
            { _id: projectId, 'overleaf.history.id': { $exists: false } },
            { 'overleaf.history.id': this.historyId }
          )
          .should.equal(true)
      })

      it('should resync the project history', function () {
        return this.ProjectEntityUpdateHandler.resyncProjectHistory
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should flush the project history', function () {
        return this.HistoryManager.flushProject
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should call the callback without an error', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the history already exists', function () {
      beforeEach(function () {
        this.project.overleaf = { history: { id: 1234 } }
        this.ProjectDetailsHandler.getDetails = sinon
          .stub()
          .withArgs(projectId)
          .callsArgWith(1, null, this.project)
        this.ProjectModel.updateOne = sinon.stub()
        return this.ProjectHistoryHandler.ensureHistoryExistsForProject(
          projectId,
          this.callback
        )
      })

      it('should get any existing history id for the project', function () {
        return this.ProjectDetailsHandler.getDetails
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should not initialize a new history in the v1 history service', function () {
        return this.HistoryManager.initializeProject.called.should.equal(false)
      })

      it('should not set the new history id on the project', function () {
        return this.ProjectModel.updateOne.called.should.equal(false)
      })

      it('should not resync the project history', function () {
        return this.ProjectEntityUpdateHandler.resyncProjectHistory.called.should.equal(
          false
        )
      })

      it('should not flush the project history', function () {
        return this.HistoryManager.flushProject.called.should.equal(false)
      })

      it('should call the callback', function () {
        return this.callback.calledWith().should.equal(true)
      })
    })
  })
})
