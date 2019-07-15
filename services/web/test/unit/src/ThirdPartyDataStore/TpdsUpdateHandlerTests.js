/* eslint-disable
    camelcase,
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
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateHandler.js'
)

describe('TpdsUpdateHandler', function() {
  beforeEach(function() {
    this.requestQueuer = {}
    this.updateMerger = {
      deleteUpdate(user_id, project_id, path, source, cb) {
        return cb()
      },
      mergeUpdate(user_id, project_id, path, update, source, cb) {
        return cb()
      }
    }
    this.editorController = {}
    this.project_id = 'dsjajilknaksdn'
    this.project = { _id: this.project_id, name: 'projectNameHere' }
    this.projectLocator = {
      findUsersProjectByName: sinon.stub().callsArgWith(2, null, this.project)
    }
    this.projectCreationHandler = {
      createBlankProject: sinon.stub().callsArgWith(2, null, this.project)
    }
    this.projectDeleter = {
      markAsDeletedByExternalSource: sinon.stub().callsArgWith(1)
    }
    this.rootDocManager = { setRootDocAutomatically: sinon.stub() }
    this.FileTypeManager = {
      shouldIgnore: sinon.stub().callsArgWith(1, null, false)
    }
    this.CooldownManager = {
      isProjectOnCooldown: sinon.stub().callsArgWith(1, null, false)
    }
    this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './UpdateMerger': this.updateMerger,
        './Editor/EditorController': this.editorController,
        '../Project/ProjectLocator': this.projectLocator,
        '../Project/ProjectCreationHandler': this.projectCreationHandler,
        '../Project/ProjectDeleter': this.projectDeleter,
        '../Project/ProjectRootDocManager': this.rootDocManager,
        '../Uploads/FileTypeManager': this.FileTypeManager,
        '../Cooldown/CooldownManager': this.CooldownManager,
        'logger-sharelatex': {
          log() {}
        }
      }
    })
    this.user_id = 'dsad29jlkjas'
    return (this.source = 'dropbox')
  })

  describe('getting an update', function() {
    it('should send the update to the update merger', function(done) {
      const path = '/path/here'
      const update = {}
      this.updateMerger.mergeUpdate = sinon.stub()
      this.updateMerger.mergeUpdate
        .withArgs(this.user_id, this.project_id, path, update, this.source)
        .callsArg(5)
      return this.handler.newUpdate(
        this.user_id,
        this.project.name,
        path,
        update,
        this.source,
        () => {
          this.projectCreationHandler.createBlankProject.called.should.equal(
            false
          )
          return done()
        }
      )
    })

    it('should create a new project if one does not already exit', function(done) {
      this.projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
      const path = '/'
      return this.handler.newUpdate(
        this.user_id,
        this.project.name,
        path,
        {},
        this.source,
        () => {
          this.projectCreationHandler.createBlankProject
            .calledWith(this.user_id, this.project.name)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should set the root doc automatically if a new project is created', function(done) {
      this.projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
      this.handler._rootDocTimeoutLength = 0
      const path = '/'
      return this.handler.newUpdate(
        this.user_id,
        this.project.name,
        path,
        {},
        this.source,
        () => {
          return setTimeout(() => {
            this.rootDocManager.setRootDocAutomatically
              .calledWith(this.project._id)
              .should.equal(true)
            return done()
          }, 1)
        }
      )
    })

    it('should not update files that should be ignored', function(done) {
      this.FileTypeManager.shouldIgnore = sinon
        .stub()
        .callsArgWith(1, null, true)
      this.projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
      const path = '/.gitignore'
      this.updateMerger.mergeUpdate = sinon.stub()
      return this.handler.newUpdate(
        this.user_id,
        this.project.name,
        path,
        {},
        this.source,
        () => {
          this.updateMerger.mergeUpdate.called.should.equal(false)
          return done()
        }
      )
    })

    it('should check if the project is on cooldown', function(done) {
      this.CooldownManager.isProjectOnCooldown = sinon
        .stub()
        .callsArgWith(1, null, false)
      this.projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
      const path = '/path/here'
      const update = {}
      this.updateMerger.mergeUpdate = sinon.stub()
      this.updateMerger.mergeUpdate
        .withArgs(this.user_id, this.project_id, path, update, this.source)
        .callsArg(5)
      return this.handler.newUpdate(
        this.user_id,
        this.project.name,
        path,
        update,
        this.source,
        err => {
          expect(err).to.be.oneOf([null, undefined])
          this.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
          this.CooldownManager.isProjectOnCooldown
            .calledWith(this.project_id)
            .should.equal(true)
          this.FileTypeManager.shouldIgnore.callCount.should.equal(1)
          this.updateMerger.mergeUpdate.callCount.should.equal(1)
          return done()
        }
      )
    })

    it('should return error and not proceed with update if project is on cooldown', function(done) {
      this.CooldownManager.isProjectOnCooldown = sinon
        .stub()
        .callsArgWith(1, null, true)
      this.projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
      this.FileTypeManager.shouldIgnore = sinon
        .stub()
        .callsArgWith(1, null, false)
      const path = '/path/here'
      const update = {}
      this.updateMerger.mergeUpdate = sinon.stub()
      this.updateMerger.mergeUpdate
        .withArgs(this.user_id, this.project_id, path, update, this.source)
        .callsArg(5)
      return this.handler.newUpdate(
        this.user_id,
        this.project.name,
        path,
        update,
        this.source,
        err => {
          expect(err).to.not.be.oneOf([null, undefined])
          expect(err).to.be.instanceof(Error)
          this.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
          this.CooldownManager.isProjectOnCooldown
            .calledWith(this.project_id)
            .should.equal(true)
          this.FileTypeManager.shouldIgnore.callCount.should.equal(0)
          this.updateMerger.mergeUpdate.callCount.should.equal(0)
          return done()
        }
      )
    })
  })

  describe('getting a delete :', function() {
    it('should call deleteEntity in the collaberation manager', function(done) {
      const path = '/delete/this'
      const update = {}
      this.updateMerger.deleteUpdate = sinon.stub().callsArg(4)

      return this.handler.deleteUpdate(
        this.user_id,
        this.project.name,
        path,
        this.source,
        () => {
          this.projectDeleter.markAsDeletedByExternalSource
            .calledWith(this.project._id)
            .should.equal(false)
          this.updateMerger.deleteUpdate
            .calledWith(this.user_id, this.project_id, path, this.source)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should mark the project as deleted by external source if path is a single slash', function(done) {
      const path = '/'
      return this.handler.deleteUpdate(
        this.user_id,
        this.project.name,
        path,
        this.source,
        () => {
          this.projectDeleter.markAsDeletedByExternalSource
            .calledWith(this.project._id)
            .should.equal(true)
          return done()
        }
      )
    })
  })
})
