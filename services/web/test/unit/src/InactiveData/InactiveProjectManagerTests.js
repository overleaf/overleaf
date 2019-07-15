/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/InactiveData/InactiveProjectManager'
)
const { expect } = require('chai')

describe('InactiveProjectManager', function() {
  beforeEach(function() {
    this.settings = {}
    this.DocstoreManager = {
      unarchiveProject: sinon.stub(),
      archiveProject: sinon.stub()
    }
    this.ProjectUpdateHandler = {
      markAsActive: sinon.stub(),
      markAsInactive: sinon.stub()
    }
    this.ProjectGetter = { getProject: sinon.stub() }
    this.TrackChangesManager = { archiveProject: sinon.stub() }
    this.InactiveProjectManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        '../Docstore/DocstoreManager': this.DocstoreManager,
        '../Project/ProjectUpdateHandler': this.ProjectUpdateHandler,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../TrackChanges/TrackChangesManager': this.TrackChangesManager,
        '../../models/Project': {}
      }
    })
    return (this.project_id = '1234')
  })

  describe('reactivateProjectIfRequired', function() {
    beforeEach(function() {
      this.project = { active: false }
      this.ProjectGetter.getProject.callsArgWith(2, null, this.project)
      return this.ProjectUpdateHandler.markAsActive.callsArgWith(1)
    })

    it('should call unarchiveProject', function(done) {
      this.DocstoreManager.unarchiveProject.callsArgWith(1)
      return this.InactiveProjectManager.reactivateProjectIfRequired(
        this.project_id,
        err => {
          this.DocstoreManager.unarchiveProject
            .calledWith(this.project_id)
            .should.equal(true)
          this.ProjectUpdateHandler.markAsActive
            .calledWith(this.project_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should not mark project as active if error with unarchinging', function(done) {
      this.DocstoreManager.unarchiveProject.callsArgWith(1, 'error')
      return this.InactiveProjectManager.reactivateProjectIfRequired(
        this.project_id,
        err => {
          err.should.equal('error')
          this.DocstoreManager.unarchiveProject
            .calledWith(this.project_id)
            .should.equal(true)
          this.ProjectUpdateHandler.markAsActive
            .calledWith(this.project_id)
            .should.equal(false)
          return done()
        }
      )
    })

    it('should not call unarchiveProject if it is active', function(done) {
      this.project.active = true
      this.DocstoreManager.unarchiveProject.callsArgWith(1)
      return this.InactiveProjectManager.reactivateProjectIfRequired(
        this.project_id,
        err => {
          this.DocstoreManager.unarchiveProject
            .calledWith(this.project_id)
            .should.equal(false)
          this.ProjectUpdateHandler.markAsActive
            .calledWith(this.project_id)
            .should.equal(false)
          return done()
        }
      )
    })
  })

  describe('deactivateProject', function() {
    it('should call unarchiveProject and markAsInactive', function(done) {
      this.DocstoreManager.archiveProject.callsArgWith(1)
      this.TrackChangesManager.archiveProject.callsArgWith(1)

      this.ProjectUpdateHandler.markAsInactive.callsArgWith(1)

      return this.InactiveProjectManager.deactivateProject(
        this.project_id,
        err => {
          this.DocstoreManager.archiveProject
            .calledWith(this.project_id)
            .should.equal(true)
          // @TrackChangesManager.archiveProject.calledWith(@project_id).should.equal true
          this.ProjectUpdateHandler.markAsInactive
            .calledWith(this.project_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should not call markAsInactive if there was a problem archiving in docstore', function(done) {
      this.DocstoreManager.archiveProject.callsArgWith(1, 'errorrr')
      this.TrackChangesManager.archiveProject.callsArgWith(1)

      this.ProjectUpdateHandler.markAsInactive.callsArgWith(1)

      return this.InactiveProjectManager.deactivateProject(
        this.project_id,
        err => {
          err.should.equal('errorrr')
          this.DocstoreManager.archiveProject
            .calledWith(this.project_id)
            .should.equal(true)
          this.ProjectUpdateHandler.markAsInactive
            .calledWith(this.project_id)
            .should.equal(false)
          return done()
        }
      )
    })
  })
})

// it "should not call markAsInactive if there was a problem archiving in track changes", (done)->
// 	@DocstoreManager.archiveProject.callsArgWith(1)
// 	@TrackChangesManager.archiveProject.callsArgWith(1, "errorrr")

// 	@ProjectUpdateHandler.markAsInactive.callsArgWith(1)

// 	@InactiveProjectManager.deactivateProject @project_id, (err)=>
// 		err.should.equal "errorrr"
// 		@DocstoreManager.archiveProject.calledWith(@project_id).should.equal true
// 		@ProjectUpdateHandler.markAsInactive.calledWith(@project_id).should.equal false
// 		done()
