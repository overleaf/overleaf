/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
    no-useless-constructor,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const modulePath = '../../../../app/src/Features/Project/ProjectDeleter'
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')

describe('ProjectDeleter', function() {
  beforeEach(function() {
    let DeletedProject
    this.project_id = '12312'
    this.project = {
      _id: this.project_id,
      rootFolder: [],
      collaberator_refs: ['collab1', 'collab2'],
      readOnly_refs: ['readOnly1', 'readOnly2'],
      owner_ref: 'owner ref here',
      remove: sinon.stub().callsArg(0)
    }

    this.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {}
    }

    this.Project = {
      update: sinon.stub().callsArgWith(3),
      remove: sinon.stub().callsArgWith(1),
      findOne: sinon.stub().callsArgWith(1, null, this.project),
      find: sinon.stub().callsArgWith(1, null, [this.project]),
      applyToAllFilesRecursivly: sinon.stub()
    }
    this.DeletedProject = DeletedProject = (function() {
      DeletedProject = class DeletedProject {
        static initClass() {
          this.prototype.save = sinon.stub().callsArgWith(0)
        }
        constructor() {}
      }
      DeletedProject.initClass()
      return DeletedProject
    })()
    this.documentUpdaterHandler = {
      flushProjectToMongoAndDelete: sinon.stub().callsArgWith(1)
    }
    this.editorController = {
      notifyUsersProjectHasBeenDeletedOrRenamed: sinon.stub().callsArgWith(1)
    }
    this.TagsHandler = {
      removeProjectFromAllTags: sinon.stub().callsArgWith(2)
    }
    this.CollaboratorsHandler = {
      removeUserFromAllProjets: sinon.stub().yields(),
      getMemberIds: sinon
        .stub()
        .withArgs(this.project_id)
        .yields(null, ['member-id-1', 'member-id-2'])
    }
    return (this.deleter = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Editor/EditorController': this.editorController,
        '../../models/Project': { Project: this.Project },
        '../../models/DeletedProject': { DeletedProject: this.DeletedProject },
        '../DocumentUpdater/DocumentUpdaterHandler': this
          .documentUpdaterHandler,
        '../Tags/TagsHandler': this.TagsHandler,
        '../FileStore/FileStoreHandler': (this.FileStoreHandler = {}),
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        'logger-sharelatex': {
          log() {}
        }
      }
    }))
  })

  describe('mark as deleted by external source', function() {
    const project_id = 1234
    it('should update the project with the flag set to true', function(done) {
      return this.deleter.markAsDeletedByExternalSource(project_id, () => {
        const conditions = { _id: project_id }
        const update = { deletedByExternalDataSource: true }
        this.Project.update.calledWith(conditions, update).should.equal(true)
        return done()
      })
    })

    it('should tell the editor controler so users are notified', function(done) {
      return this.deleter.markAsDeletedByExternalSource(project_id, () => {
        this.editorController.notifyUsersProjectHasBeenDeletedOrRenamed
          .calledWith(project_id)
          .should.equal(true)
        return done()
      })
    })
  })

  describe('unmarkAsDeletedByExternalSource', function() {
    beforeEach(function() {
      this.Project.update = sinon.stub().callsArg(3)
      this.callback = sinon.stub()
      this.project = {
        _id: this.project_id
      }
      return this.deleter.unmarkAsDeletedByExternalSource(
        this.project_id,
        this.callback
      )
    })

    it('should remove the flag from the project', function() {
      return this.Project.update
        .calledWith(
          { _id: this.project_id },
          { deletedByExternalDataSource: false }
        )
        .should.equal(true)
    })
  })

  describe('deleteUsersProjects', function() {
    beforeEach(function() {
      return (this.deleter.deleteProject = sinon.stub().callsArg(1))
    })

    it('should find all the projects owned by the user_id', function(done) {
      return this.deleter.deleteUsersProjects(this.user._id, () => {
        sinon.assert.calledWith(this.Project.find, { owner_ref: this.user._id })
        return done()
      })
    })

    it('should call deleteProject on the found projects', function(done) {
      return this.deleter.deleteUsersProjects(this.user._id, () => {
        sinon.assert.calledWith(this.deleter.deleteProject, this.project._id)
        return done()
      })
    })

    it('should call deleteProject once for each project', function(done) {
      this.Project.find.callsArgWith(1, null, [
        { _id: 'potato' },
        { _id: 'wombat' }
      ])
      return this.deleter.deleteUsersProjects(this.user._id, () => {
        sinon.assert.calledTwice(this.deleter.deleteProject)
        sinon.assert.calledWith(this.deleter.deleteProject, 'wombat')
        sinon.assert.calledWith(this.deleter.deleteProject, 'potato')
        return done()
      })
    })

    it('should remove all the projects the user is a collaborator of', function(done) {
      return this.deleter.deleteUsersProjects(this.user._id, () => {
        this.CollaboratorsHandler.removeUserFromAllProjets
          .calledWith(this.user._id)
          .should.equal(true)
        return done()
      })
    })
  })

  describe('deleteProject', function() {
    beforeEach(function() {
      this.project_id = 'mock-project-id-123'
      return (this.ip = '192.170.18.1')
    })

    it('should save a DeletedProject with additional deleterData', function(done) {
      return this.deleter.deleteProject(
        this.project_id,
        { deleterUser: this.user, ipAddress: this.ip },
        (err, deletedProject) => {
          this.DeletedProject.prototype.save.called.should.equal(true)
          deletedProject.deleterData.deleterIpAddress.should.equal(this.ip)
          deletedProject.deleterData.deleterId.should.equal(this.user._id)
          return done()
        }
      )
    })

    it('should flushProjectToMongoAndDelete in doc updater', function(done) {
      return this.deleter.deleteProject(
        this.project_id,
        { deleterUser: this.user, ipAddress: this.ip },
        () => {
          this.documentUpdaterHandler.flushProjectToMongoAndDelete
            .calledWith(this.project_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should removeProjectFromAllTags', function(done) {
      return this.deleter.deleteProject(this.project_id, () => {
        this.TagsHandler.removeProjectFromAllTags
          .calledWith('member-id-1', this.project_id)
          .should.equal(true)
        this.TagsHandler.removeProjectFromAllTags
          .calledWith('member-id-2', this.project_id)
          .should.equal(true)
        return done()
      })
    })

    it('should remove the project from Mongo', function(done) {
      return this.deleter.deleteProject(this.project_id, () => {
        this.Project.remove
          .calledWith({
            _id: this.project_id
          })
          .should.equal(true)
        return done()
      })
    })
  })

  describe('archiveProject', function() {
    beforeEach(function() {
      return this.Project.update.callsArgWith(2)
    })

    it('should update the project', function(done) {
      return this.deleter.archiveProject(this.project_id, () => {
        this.Project.update
          .calledWith(
            {
              _id: this.project_id
            },
            {
              $set: { archived: true }
            }
          )
          .should.equal(true)
        return done()
      })
    })
  })

  describe('restoreProject', function() {
    beforeEach(function() {
      return this.Project.update.callsArgWith(2)
    })

    it('should unset the archive attribute', function(done) {
      return this.deleter.restoreProject(this.project_id, () => {
        this.Project.update
          .calledWith(
            {
              _id: this.project_id
            },
            {
              $unset: { archived: true }
            }
          )
          .should.equal(true)
        return done()
      })
    })
  })
})
