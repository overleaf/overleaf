const modulePath = '../../../../app/src/Features/Project/ProjectDeleter'
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const tk = require('timekeeper')
const moment = require('moment')
const { Project } = require('../helpers/models/Project')
const { DeletedProject } = require('../helpers/models/DeletedProject')
const { ObjectId } = require('mongoose').Types

describe('ProjectDeleter', function() {
  beforeEach(function() {
    tk.freeze(Date.now())
    this.project_id = ObjectId('588fffffffffffffffffffff')
    this.ip = '192.170.18.1'
    this.project = {
      _id: this.project_id,
      lastUpdated: new Date(),
      rootFolder: [],
      collaberator_refs: [
        ObjectId('5b895d372f4189011c2f5afc'),
        ObjectId('5b8d40073ead20011caca726')
      ],
      readOnly_refs: [
        ObjectId('5b8d4602b2f786011c4fb244'),
        ObjectId('5b8d4a57c1cd2b011c39161c')
      ],
      tokenAccessReadAndWrite_refs: [
        ObjectId('5b8d5663a26df3035ea0d5a1'),
        ObjectId('5b8e8676373c14011c2cad3c')
      ],
      tokenAccessReadOnly_refs: [
        ObjectId('5b9b801b5dd22c011ba5d9b3'),
        ObjectId('5bc5adae1cad8d011fd4060a')
      ],
      owner_ref: ObjectId('588aaaaaaaaaaaaaaaaaaaaa'),
      tokens: {
        readOnly: 'wombat',
        readAndWrite: 'potato'
      },
      overleaf: {
        id: 1234,
        history: {
          id: 5678
        }
      },
      name: 'a very scientific analysis of spooky ghosts'
    }

    this.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {}
    }

    this.doc = {
      _id: '5bd975f54f62e803cb8a8fec',
      lines: ['a bunch of lines', 'for a sunny day', 'in London town'],
      ranges: {},
      project_id: '5cf9270b4eff6e186cf8b05e'
    }

    this.deletedProjects = [
      {
        _id: '5cf7f145c1401f0ca0eb1aaa',
        deleterData: {
          _id: '5cf7f145c1401f0ca0eb1aac',
          deletedAt: moment()
            .subtract(95, 'days')
            .toDate(),
          deleterId: '588f3ddae8ebc1bac07c9fa4',
          deleterIpAddress: '172.19.0.1',
          deletedProjectId: '5cf9270b4eff6e186cf8b05e'
        },
        project: {
          _id: '5cf9270b4eff6e186cf8b05e'
        }
      },
      {
        _id: '5cf8eb11c1401f0ca0eb1ad7',
        deleterData: {
          _id: '5b74360c0fbe57011ae9938f',
          deletedAt: moment()
            .subtract(95, 'days')
            .toDate(),
          deleterId: '588f3ddae8ebc1bac07c9fa4',
          deleterIpAddress: '172.20.0.1',
          deletedProjectId: '5cf8f95a0c87371362c23919'
        },
        project: {
          _id: '5cf8f95a0c87371362c23919'
        }
      }
    ]

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
      removeUserFromAllProjects: sinon.stub().yields()
    }
    this.CollaboratorsGetter = {
      promises: {
        getMemberIds: sinon
          .stub()
          .withArgs(this.project_id)
          .resolves(['member-id-1', 'member-id-2'])
      }
    }

    this.logger = {
      err: sinon.stub(),
      log: sinon.stub(),
      warn: sinon.stub()
    }

    this.ProjectDetailsHandler = {
      promises: {
        generateUniqueName: sinon.stub().resolves(this.project.name)
      }
    }

    this.ProjectHelper = {
      calculateArchivedArray: sinon.stub()
    }

    this.db = {
      projects: {
        insert: sinon.stub().yields()
      }
    }

    this.DocstoreManager = {
      destroyProject: sinon.stub().yields()
    }

    this.ProjectMock = sinon.mock(Project)
    this.DeletedProjectMock = sinon.mock(DeletedProject)

    this.ProjectDeleter = SandboxedModule.require(modulePath, {
      requires: {
        '../Editor/EditorController': this.editorController,
        '../../models/Project': { Project: Project },
        './ProjectHelper': this.ProjectHelper,
        '../../models/DeletedProject': { DeletedProject: DeletedProject },
        '../DocumentUpdater/DocumentUpdaterHandler': this
          .documentUpdaterHandler,
        '../Tags/TagsHandler': this.TagsHandler,
        '../FileStore/FileStoreHandler': (this.FileStoreHandler = {}),
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../Docstore/DocstoreManager': this.DocstoreManager,
        './ProjectDetailsHandler': this.ProjectDetailsHandler,
        '../../infrastructure/mongojs': { db: this.db, ObjectId },
        'logger-sharelatex': this.logger
      },
      globals: {
        console: console
      }
    })
  })

  afterEach(function() {
    tk.reset()
    this.DeletedProjectMock.restore()
    this.ProjectMock.restore()
  })

  describe('mark as deleted by external source', function() {
    beforeEach(function() {
      this.ProjectMock.expects('update')
        .withArgs(
          { _id: this.project_id },
          { deletedByExternalDataSource: true }
        )
        .yields()
    })

    it('should update the project with the flag set to true', function(done) {
      this.ProjectDeleter.markAsDeletedByExternalSource(this.project_id, () => {
        this.ProjectMock.verify()
        done()
      })
    })

    it('should tell the editor controler so users are notified', function(done) {
      this.ProjectDeleter.markAsDeletedByExternalSource(this.project_id, () => {
        this.editorController.notifyUsersProjectHasBeenDeletedOrRenamed
          .calledWith(this.project_id)
          .should.equal(true)
        done()
      })
    })
  })

  describe('unmarkAsDeletedByExternalSource', function(done) {
    beforeEach(function() {
      this.ProjectMock.expects('update')
        .withArgs(
          { _id: this.project_id },
          { deletedByExternalDataSource: false }
        )
        .yields()
      this.ProjectDeleter.unmarkAsDeletedByExternalSource(this.project_id, done)
    })

    it('should remove the flag from the project', function() {
      this.ProjectMock.verify()
    })
  })

  describe('deleteUsersProjects', function() {
    beforeEach(function() {
      this.ProjectMock.expects('find')
        .withArgs({ owner_ref: this.user._id })
        .yields(null, [{ _id: 'wombat' }, { _id: 'potato' }])

      this.ProjectDeleter.deleteProject = sinon.stub().yields()
    })

    it('should find all the projects owned by the user_id', function(done) {
      this.ProjectDeleter.deleteUsersProjects(this.user._id, () => {
        this.ProjectMock.verify()
        done()
      })
    })

    it('should call deleteProject once for each project', function(done) {
      this.ProjectDeleter.deleteUsersProjects(this.user._id, () => {
        sinon.assert.calledTwice(this.ProjectDeleter.deleteProject)
        sinon.assert.calledWith(this.ProjectDeleter.deleteProject, 'wombat')
        sinon.assert.calledWith(this.ProjectDeleter.deleteProject, 'potato')
        done()
      })
    })

    it('should remove all the projects the user is a collaborator of', function(done) {
      this.ProjectDeleter.deleteUsersProjects(this.user._id, () => {
        sinon.assert.calledWith(
          this.CollaboratorsHandler.removeUserFromAllProjects,
          this.user._id
        )
        sinon.assert.calledOnce(
          this.CollaboratorsHandler.removeUserFromAllProjects
        )
        done()
      })
    })
  })

  describe('deleteProject', function() {
    beforeEach(function() {
      this.deleterData = {
        deletedAt: new Date(),
        deletedProjectId: this.project._id,
        deletedProjectOwnerId: this.project.owner_ref,
        deletedProjectCollaboratorIds: this.project.collaberator_refs,
        deletedProjectReadOnlyIds: this.project.readOnly_refs,
        deletedProjectReadWriteTokenAccessIds: this.project
          .tokenAccessReadAndWrite_refs,
        deletedProjectReadOnlyTokenAccessIds: this.project
          .tokenAccessReadOnly_refs,
        deletedProjectReadWriteToken: this.project.tokens.readAndWrite,
        deletedProjectReadOnlyToken: this.project.tokens.readOnly,
        deletedProjectOverleafId: this.project.overleaf.id,
        deletedProjectOverleafHistoryId: this.project.overleaf.history.id,
        deletedProjectLastUpdatedAt: this.project.lastUpdated
      }

      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project_id })
        .chain('exec')
        .resolves(this.project)
    })

    it('should save a DeletedProject with additional deleterData', function(done) {
      this.deleterData.deleterIpAddress = this.ip
      this.deleterData.deleterId = this.user._id

      this.ProjectMock.expects('remove')
        .chain('exec')
        .resolves()
      this.DeletedProjectMock.expects('create')
        .withArgs({
          project: this.project,
          deleterData: this.deleterData
        })
        .resolves()

      this.ProjectDeleter.deleteProject(
        this.project_id,
        { deleterUser: this.user, ipAddress: this.ip },
        err => {
          expect(err).not.to.exist
          this.DeletedProjectMock.verify()
          done()
        }
      )
    })

    it('should flushProjectToMongoAndDelete in doc updater', function(done) {
      this.ProjectMock.expects('remove')
        .chain('exec')
        .resolves()
      this.DeletedProjectMock.expects('create').resolves()

      this.ProjectDeleter.deleteProject(
        this.project_id,
        { deleterUser: this.user, ipAddress: this.ip },
        () => {
          this.documentUpdaterHandler.flushProjectToMongoAndDelete
            .calledWith(this.project_id)
            .should.equal(true)
          done()
        }
      )
    })

    it('should removeProjectFromAllTags', function(done) {
      this.ProjectMock.expects('remove')
        .chain('exec')
        .resolves()
      this.DeletedProjectMock.expects('create').resolves()

      this.ProjectDeleter.deleteProject(this.project_id, () => {
        sinon.assert.calledWith(
          this.TagsHandler.removeProjectFromAllTags,
          'member-id-1',
          this.project_id
        )
        sinon.assert.calledWith(
          this.TagsHandler.removeProjectFromAllTags,
          'member-id-2',
          this.project_id
        )
        done()
      })
    })

    it('should remove the project from Mongo', function(done) {
      this.ProjectMock.expects('remove')
        .withArgs({ _id: this.project_id })
        .chain('exec')
        .resolves()
      this.DeletedProjectMock.expects('create').resolves()

      this.ProjectDeleter.deleteProject(this.project_id, () => {
        this.ProjectMock.verify()
        done()
      })
    })
  })

  describe('expireDeletedProjectsAfterDuration', function() {
    beforeEach(function(done) {
      this.ProjectDeleter.expireDeletedProject = sinon
        .stub()
        .callsArgWith(1, null)

      this.DeletedProjectMock.expects('find')
        .withArgs({
          'deleterData.deletedAt': {
            $lt: new Date(moment().subtract(90, 'days'))
          },
          project: {
            $ne: null
          }
        })
        .yields(null, this.deletedProjects)

      this.ProjectDeleter.expireDeletedProjectsAfterDuration(done)
    })

    it('should call find with a date 90 days earlier than today', function() {
      this.DeletedProjectMock.verify()
    })

    it('should call expireDeletedProject', function(done) {
      expect(this.ProjectDeleter.expireDeletedProject).to.have.been.calledWith(
        this.deletedProjects[0].deleterData.deletedProjectId
      )
      done()
    })
  })

  describe('expireDeletedProject', function() {
    beforeEach(function(done) {
      this.DeletedProjectMock.expects('update')
        .withArgs(
          {
            _id: this.deletedProjects[0]._id
          },
          {
            $set: {
              'deleterData.deleterIpAddress': null,
              project: null
            }
          }
        )
        .chain('exec')
        .resolves()

      this.DeletedProjectMock.expects('findOne')
        .withArgs({
          'deleterData.deletedProjectId': this.deletedProjects[0].project._id
        })
        .chain('exec')
        .resolves(this.deletedProjects[0])

      this.ProjectDeleter.expireDeletedProject(
        this.deletedProjects[0].project._id,
        done
      )
    })

    it('should find the specified deletedProject and remove its project and ip address', function() {
      this.DeletedProjectMock.verify()
    })

    it('should destroy the docs in docstore', function() {
      expect(this.DocstoreManager.destroyProject).to.have.been.calledWith(
        this.deletedProjects[0].project._id
      )
    })
  })

  describe('legacyArchiveProject', function() {
    beforeEach(function() {
      this.ProjectMock.expects('update')
        .withArgs(
          {
            _id: this.project_id
          },
          {
            $set: { archived: true }
          }
        )
        .yields()
    })

    it('should update the project', function(done) {
      this.ProjectDeleter.legacyArchiveProject(this.project_id, () => {
        this.ProjectMock.verify()
        done()
      })
    })
  })

  describe('archiveProject', function() {
    beforeEach(function() {
      let archived = [ObjectId(this.user._id)]
      this.ProjectHelper.calculateArchivedArray.returns(archived)

      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project_id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('update')
        .withArgs(
          { _id: this.project_id },
          {
            $set: { archived: archived },
            $pull: { trashed: ObjectId(this.user._id) }
          }
        )
        .resolves()
    })

    it('should update the project', async function() {
      await this.ProjectDeleter.promises.archiveProject(
        this.project_id,
        this.user._id
      )
      this.ProjectMock.verify()
    })
  })

  describe('unarchiveProject', function() {
    beforeEach(function() {
      let archived = [ObjectId(this.user._id)]
      this.ProjectHelper.calculateArchivedArray.returns(archived)

      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project_id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('update')
        .withArgs({ _id: this.project_id }, { $set: { archived: archived } })
        .resolves()
    })

    it('should update the project', async function() {
      await this.ProjectDeleter.promises.unarchiveProject(
        this.project_id,
        this.user._id
      )
      this.ProjectMock.verify()
    })
  })

  describe('trashProject', function() {
    beforeEach(function() {
      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project_id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('update')
        .withArgs(
          { _id: this.project_id },
          {
            $addToSet: { trashed: ObjectId(this.user._id) },
            $pull: { archived: ObjectId(this.user._id) }
          }
        )
        .resolves()
    })

    it('should update the project', async function() {
      await this.ProjectDeleter.promises.trashProject(
        this.project_id,
        this.user._id
      )
      this.ProjectMock.verify()
    })
  })

  describe('untrashProject', function() {
    beforeEach(function() {
      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project_id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('update')
        .withArgs(
          { _id: this.project_id },
          { $pull: { trashed: ObjectId(this.user._id) } }
        )
        .resolves()
    })

    it('should update the project', async function() {
      await this.ProjectDeleter.promises.untrashProject(
        this.project_id,
        this.user._id
      )
      this.ProjectMock.verify()
    })
  })

  describe('restoreProject', function() {
    beforeEach(function() {
      this.ProjectMock.expects('update')
        .withArgs(
          {
            _id: this.project_id
          },
          {
            $unset: { archived: true }
          }
        )
        .yields()
    })

    it('should unset the archive attribute', function(done) {
      this.ProjectDeleter.restoreProject(this.project_id, () => {
        this.ProjectMock.verify()
        done()
      })
    })
  })

  describe('undeleteProject', function() {
    beforeEach(function() {
      this.deletedProject = {
        _id: 'deleted',
        project: this.project,
        deleterData: {
          deletedProjectId: this.project._id,
          deletedProjectOwnerId: this.project.owner_ref
        }
      }
      this.purgedProject = {
        _id: 'purged',
        deleterData: {
          deletedProjectId: 'purgedProject',
          deletedProjectOwnerId: 'potato'
        }
      }

      this.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': this.project._id })
        .chain('exec')
        .resolves(this.deletedProject)
      this.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': 'purgedProject' })
        .chain('exec')
        .resolves(this.purgedProject)
      this.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': 'wombat' })
        .chain('exec')
        .resolves(null)
      this.DeletedProjectMock.expects('deleteOne')
        .chain('exec')
        .resolves()
    })

    it('should return not found if the project does not exist', function(done) {
      this.ProjectDeleter.undeleteProject('wombat', err => {
        expect(err).to.exist
        expect(err.name).to.equal('NotFoundError')
        expect(err.message).to.equal('project_not_found')
        done()
      })
    })

    it('should return not found if the project has been expired', function(done) {
      this.ProjectDeleter.undeleteProject('purgedProject', err => {
        expect(err.name).to.equal('NotFoundError')
        expect(err.message).to.equal('project_too_old_to_restore')
        done()
      })
    })

    it('should insert the project into the collection', function(done) {
      this.ProjectDeleter.undeleteProject(this.project._id, err => {
        expect(err).not.to.exist
        sinon.assert.calledWith(
          this.db.projects.insert,
          sinon.match({
            _id: this.project._id,
            name: this.project.name
          })
        )
        done()
      })
    })

    it('should clear the archive bit', function(done) {
      this.project.archived = true
      this.ProjectDeleter.undeleteProject(this.project._id, err => {
        expect(err).not.to.exist
        sinon.assert.calledWith(
          this.db.projects.insert,
          sinon.match({ archived: undefined })
        )
        done()
      })
    })

    it('should generate a unique name for the project', function(done) {
      this.ProjectDeleter.undeleteProject(this.project._id, err => {
        expect(err).not.to.exist
        sinon.assert.calledWith(
          this.ProjectDetailsHandler.promises.generateUniqueName,
          this.project.owner_ref
        )
        done()
      })
    })

    it('should add a suffix to the project name', function(done) {
      this.ProjectDeleter.undeleteProject(this.project._id, err => {
        expect(err).not.to.exist
        sinon.assert.calledWith(
          this.ProjectDetailsHandler.promises.generateUniqueName,
          this.project.owner_ref,
          this.project.name + ' (Restored)'
        )
        done()
      })
    })

    it('should remove the DeletedProject', function(done) {
      // need to change the mock just to include the methods we want
      this.DeletedProjectMock.restore()
      this.DeletedProjectMock = sinon.mock(DeletedProject)
      this.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': this.project._id })
        .chain('exec')
        .resolves(this.deletedProject)
      this.DeletedProjectMock.expects('deleteOne')
        .withArgs({ _id: 'deleted' })
        .chain('exec')
        .resolves()

      this.ProjectDeleter.undeleteProject(this.project._id, err => {
        expect(err).not.to.exist
        this.DeletedProjectMock.verify()
        done()
      })
    })
  })
})
