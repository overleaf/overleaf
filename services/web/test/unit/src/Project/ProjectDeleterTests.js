const modulePath = '../../../../app/src/Features/Project/ProjectDeleter'
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const tk = require('timekeeper')
const moment = require('moment')
const { Project } = require('../helpers/models/Project')
const { DeletedProject } = require('../helpers/models/DeletedProject')
const { ObjectId, ReadPreference } = require('mongodb-legacy')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('ProjectDeleter', function () {
  beforeEach(function () {
    tk.freeze(Date.now())
    this.ip = '192.170.18.1'
    this.project = dummyProject()
    this.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {},
    }

    this.doc = {
      _id: '5bd975f54f62e803cb8a8fec',
      lines: ['a bunch of lines', 'for a sunny day', 'in London town'],
      ranges: {},
      project_id: '5cf9270b4eff6e186cf8b05e',
    }

    this.deletedProjects = [
      {
        _id: '5cf7f145c1401f0ca0eb1aaa',
        deleterData: {
          _id: '5cf7f145c1401f0ca0eb1aac',
          deletedAt: moment().subtract(95, 'days').toDate(),
          deleterId: '588f3ddae8ebc1bac07c9fa4',
          deleterIpAddress: '172.19.0.1',
          deletedProjectId: '5cf9270b4eff6e186cf8b05e',
        },
        project: {
          _id: '5cf9270b4eff6e186cf8b05e',
          overleaf: {
            history: {
              id: new ObjectId(),
            },
          },
        },
      },
      {
        _id: '5cf8eb11c1401f0ca0eb1ad7',
        deleterData: {
          _id: '5b74360c0fbe57011ae9938f',
          deletedAt: moment().subtract(95, 'days').toDate(),
          deleterId: '588f3ddae8ebc1bac07c9fa4',
          deleterIpAddress: '172.20.0.1',
          deletedProjectId: '5cf8f95a0c87371362c23919',
        },
        project: {
          _id: '5cf8f95a0c87371362c23919',
        },
      },
    ]

    this.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongoAndDelete: sinon.stub().resolves(),
      },
    }
    this.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }
    this.TagsHandler = {
      promises: {
        removeProjectFromAllTags: sinon.stub().resolves(),
      },
    }
    this.CollaboratorsHandler = {
      promises: {
        removeUserFromAllProjects: sinon.stub().resolves(),
      },
    }
    this.CollaboratorsGetter = {
      promises: {
        getMemberIds: sinon
          .stub()
          .withArgs(this.project._id)
          .resolves(['member-id-1', 'member-id-2']),
      },
    }

    this.ProjectDetailsHandler = {
      promises: {
        generateUniqueName: sinon.stub().resolves(this.project.name),
      },
    }

    this.ProjectHelper = {
      calculateArchivedArray: sinon.stub(),
    }

    this.db = {
      deletedFiles: {
        indexExists: sinon.stub().resolves(false),
        deleteMany: sinon.stub(),
      },
      projects: {
        insertOne: sinon.stub().resolves(),
      },
    }

    this.DocstoreManager = {
      promises: {
        archiveProject: sinon.stub().resolves(),
        destroyProject: sinon.stub().resolves(),
      },
    }
    this.HistoryManager = {
      promises: {
        deleteProject: sinon.stub().resolves(),
      },
    }

    this.ProjectMock = sinon.mock(Project)
    this.DeletedProjectMock = sinon.mock(DeletedProject)
    this.FileStoreHandler = {
      promises: {
        deleteProject: sinon.stub().resolves(),
      },
    }
    this.Features = {
      hasFeature: sinon.stub().returns(true),
    }
    this.ChatApiHandler = {
      promises: {
        destroyProject: sinon.stub().resolves(),
      },
    }
    this.ProjectAuditLogEntry = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    this.ProjectDeleter = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/Modules': {
          promises: { hooks: { fire: sinon.stub().resolves() } },
        },
        '../../infrastructure/Features': this.Features,
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        '../../models/Project': { Project },
        './ProjectHelper': this.ProjectHelper,
        '../../models/DeletedProject': { DeletedProject },
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../Tags/TagsHandler': this.TagsHandler,
        '../FileStore/FileStoreHandler': this.FileStoreHandler,
        '../Chat/ChatApiHandler': this.ChatApiHandler,
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../Docstore/DocstoreManager': this.DocstoreManager,
        './ProjectDetailsHandler': this.ProjectDetailsHandler,
        '../../infrastructure/mongodb': {
          db: this.db,
          ObjectId,
          READ_PREFERENCE_SECONDARY: ReadPreference.secondaryPreferred.mode,
        },
        '../History/HistoryManager': this.HistoryManager,
        '../../models/ProjectAuditLogEntry': {
          ProjectAuditLogEntry: this.ProjectAuditLogEntry,
        },
      },
    })
  })

  afterEach(function () {
    tk.reset()
    this.DeletedProjectMock.restore()
    this.ProjectMock.restore()
  })

  describe('mark as deleted by external source', function () {
    beforeEach(function () {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: this.project._id },
          { deletedByExternalDataSource: true }
        )
        .chain('exec')
        .resolves()
    })

    it('should update the project with the flag set to true', async function () {
      await this.ProjectDeleter.promises.markAsDeletedByExternalSource(
        this.project._id
      )
      this.ProjectMock.verify()
    })

    it('should tell the editor controler so users are notified', async function () {
      await this.ProjectDeleter.promises.markAsDeletedByExternalSource(
        this.project._id
      )
      expect(this.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        this.project._id,
        'projectRenamedOrDeletedByExternalSource'
      )
    })
  })

  describe('unmarkAsDeletedByExternalSource', function () {
    beforeEach(async function () {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: this.project._id },
          { deletedByExternalDataSource: false }
        )
        .chain('exec')
        .resolves()
      await this.ProjectDeleter.promises.unmarkAsDeletedByExternalSource(
        this.project._id
      )
    })

    it('should remove the flag from the project', function () {
      this.ProjectMock.verify()
    })
  })

  describe('deleteUsersProjects', function () {
    beforeEach(function () {
      this.projects = [dummyProject(), dummyProject()]
      this.ProjectMock.expects('find')
        .withArgs({ owner_ref: this.user._id })
        .chain('exec')
        .resolves(this.projects)
      for (const project of this.projects) {
        this.ProjectMock.expects('findOne')
          .withArgs({ _id: project._id })
          .chain('exec')
          .resolves(project)
        this.ProjectMock.expects('deleteOne')
          .withArgs({ _id: project._id })
          .chain('exec')
          .resolves()
        this.DeletedProjectMock.expects('updateOne')
          .withArgs(
            { 'deleterData.deletedProjectId': project._id },
            {
              project,
              deleterData: sinon.match.object,
            },
            { upsert: true }
          )
          .resolves()
      }
    })

    it('should delete all projects owned by the user', async function () {
      await this.ProjectDeleter.promises.deleteUsersProjects(this.user._id)
      this.ProjectMock.verify()
      this.DeletedProjectMock.verify()
    })

    it('should remove any collaboration from this user', async function () {
      await this.ProjectDeleter.promises.deleteUsersProjects(this.user._id)
      sinon.assert.calledWith(
        this.CollaboratorsHandler.promises.removeUserFromAllProjects,
        this.user._id
      )
      sinon.assert.calledOnce(
        this.CollaboratorsHandler.promises.removeUserFromAllProjects
      )
    })
  })

  describe('deleteProject', function () {
    beforeEach(function () {
      this.deleterData = {
        deletedAt: new Date(),
        deletedProjectId: this.project._id,
        deletedProjectOwnerId: this.project.owner_ref,
        deletedProjectCollaboratorIds: this.project.collaberator_refs,
        deletedProjectReadOnlyIds: this.project.readOnly_refs,
        deletedProjectReadWriteTokenAccessIds:
          this.project.tokenAccessReadAndWrite_refs,
        deletedProjectReadOnlyTokenAccessIds:
          this.project.tokenAccessReadOnly_refs,
        deletedProjectReadWriteToken: this.project.tokens.readAndWrite,
        deletedProjectReadOnlyToken: this.project.tokens.readOnly,
        deletedProjectOverleafId: this.project.overleaf.id,
        deletedProjectOverleafHistoryId: this.project.overleaf.history.id,
        deletedProjectLastUpdatedAt: this.project.lastUpdated,
      }

      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project._id })
        .chain('exec')
        .resolves(this.project)
    })

    it('should save a DeletedProject with additional deleterData', async function () {
      this.deleterData.deleterIpAddress = this.ip
      this.deleterData.deleterId = this.user._id

      this.ProjectMock.expects('deleteOne').chain('exec').resolves()
      this.DeletedProjectMock.expects('updateOne')
        .withArgs(
          { 'deleterData.deletedProjectId': this.project._id },
          {
            project: this.project,
            deleterData: this.deleterData,
          },
          { upsert: true }
        )
        .resolves()

      await this.ProjectDeleter.promises.deleteProject(this.project._id, {
        deleterUser: this.user,
        ipAddress: this.ip,
      })
      this.DeletedProjectMock.verify()
    })

    it('should flushProjectToMongoAndDelete in doc updater', async function () {
      this.ProjectMock.expects('deleteOne').chain('exec').resolves()
      this.DeletedProjectMock.expects('updateOne').resolves()

      await this.ProjectDeleter.promises.deleteProject(this.project._id, {
        deleterUser: this.user,
        ipAddress: this.ip,
      })
      this.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete
        .calledWith(this.project._id)
        .should.equal(true)
    })

    it('should flush docs out of mongo', async function () {
      this.ProjectMock.expects('deleteOne').chain('exec').resolves()
      this.DeletedProjectMock.expects('updateOne').resolves()
      await this.ProjectDeleter.promises.deleteProject(this.project._id, {
        deleterUser: this.user,
        ipAddress: this.ip,
      })
      expect(
        this.DocstoreManager.promises.archiveProject
      ).to.have.been.calledWith(this.project._id)
    })

    it('should flush docs out of mongo and ignore errors', async function () {
      this.ProjectMock.expects('deleteOne').chain('exec').resolves()
      this.DeletedProjectMock.expects('updateOne').resolves()
      this.DocstoreManager.promises.archiveProject.rejects(new Error('foo'))
      await this.ProjectDeleter.promises.deleteProject(this.project._id, {
        deleterUser: this.user,
        ipAddress: this.ip,
      })
    })

    it('should removeProjectFromAllTags', async function () {
      this.ProjectMock.expects('deleteOne').chain('exec').resolves()
      this.DeletedProjectMock.expects('updateOne').resolves()

      await this.ProjectDeleter.promises.deleteProject(this.project._id)
      sinon.assert.calledWith(
        this.TagsHandler.promises.removeProjectFromAllTags,
        'member-id-1',
        this.project._id
      )
      sinon.assert.calledWith(
        this.TagsHandler.promises.removeProjectFromAllTags,
        'member-id-2',
        this.project._id
      )
    })

    it('should remove the project from Mongo', async function () {
      this.ProjectMock.expects('deleteOne')
        .withArgs({ _id: this.project._id })
        .chain('exec')
        .resolves()
      this.DeletedProjectMock.expects('updateOne').resolves()

      await this.ProjectDeleter.promises.deleteProject(this.project._id)
      this.ProjectMock.verify()
    })
  })

  describe('expireDeletedProjectsAfterDuration', function () {
    beforeEach(async function () {
      for (const deletedProject of this.deletedProjects) {
        this.ProjectMock.expects('findById')
          .withArgs(deletedProject.deleterData.deletedProjectId)
          .chain('exec')
          .resolves(null)
      }
      this.DeletedProjectMock.expects('find')
        .withArgs({
          'deleterData.deletedAt': {
            $lt: new Date(moment().subtract(90, 'days')),
          },
          project: {
            $type: 'object',
          },
        })
        .chain('exec')
        .resolves(this.deletedProjects)

      for (const deletedProject of this.deletedProjects) {
        this.DeletedProjectMock.expects('findOne')
          .withArgs({
            'deleterData.deletedProjectId': deletedProject.project._id,
          })
          .chain('exec')
          .resolves(deletedProject)
        this.DeletedProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: deletedProject._id,
            },
            {
              $set: {
                'deleterData.deleterIpAddress': null,
                project: null,
              },
            }
          )
          .chain('exec')
          .resolves()
      }

      await this.ProjectDeleter.promises.expireDeletedProjectsAfterDuration()
    })

    it('should expire projects older than 90 days', function () {
      this.DeletedProjectMock.verify()
    })
  })

  describe('expireDeletedProject', function () {
    describe('on an inactive project', function () {
      beforeEach(async function () {
        this.ProjectMock.expects('findById')
          .withArgs(this.deletedProjects[0].deleterData.deletedProjectId)
          .chain('exec')
          .resolves(null)
        this.DeletedProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.deletedProjects[0]._id,
            },
            {
              $set: {
                'deleterData.deleterIpAddress': null,
                project: null,
              },
            }
          )
          .chain('exec')
          .resolves()

        this.DeletedProjectMock.expects('findOne')
          .withArgs({
            'deleterData.deletedProjectId': this.deletedProjects[0].project._id,
          })
          .chain('exec')
          .resolves(this.deletedProjects[0])

        await this.ProjectDeleter.promises.expireDeletedProject(
          this.deletedProjects[0].project._id
        )
      })

      it('should find the specified deletedProject and remove its project and ip address', function () {
        this.DeletedProjectMock.verify()
      })

      it('should destroy the docs in docstore', function () {
        expect(
          this.DocstoreManager.promises.destroyProject
        ).to.have.been.calledWith(this.deletedProjects[0].project._id)
      })

      it('should delete the project in history', function () {
        expect(
          this.HistoryManager.promises.deleteProject
        ).to.have.been.calledWith(
          this.deletedProjects[0].project._id,
          this.deletedProjects[0].project.overleaf.history.id
        )
      })

      it('should destroy the files in filestore', function () {
        expect(
          this.FileStoreHandler.promises.deleteProject
        ).to.have.been.calledWith(this.deletedProjects[0].project._id)
      })

      it('should destroy the chat threads and messages', function () {
        expect(
          this.ChatApiHandler.promises.destroyProject
        ).to.have.been.calledWith(this.deletedProjects[0].project._id)
      })

      it('should delete audit logs', async function () {
        expect(this.ProjectAuditLogEntry.deleteMany).to.have.been.calledWith({
          projectId: this.deletedProjects[0].project._id,
        })
      })
    })

    describe('on an active project (from an incomplete delete)', function () {
      beforeEach(async function () {
        this.ProjectMock.expects('findById')
          .withArgs(this.deletedProjects[0].deleterData.deletedProjectId)
          .chain('exec')
          .resolves(this.deletedProjects[0].project)
        this.DeletedProjectMock.expects('deleteOne')
          .withArgs({
            'deleterData.deletedProjectId': this.deletedProjects[0].project._id,
          })
          .chain('exec')
          .resolves()
        await this.ProjectDeleter.promises.expireDeletedProject(
          this.deletedProjects[0].project._id
        )
      })

      it('should delete the spurious deleted project record', function () {
        this.DeletedProjectMock.verify()
      })

      it('should not destroy the docs in docstore', function () {
        expect(this.DocstoreManager.promises.destroyProject).to.not.have.been
          .called
      })

      it('should not delete the project in history', function () {
        expect(this.HistoryManager.promises.deleteProject).to.not.have.been
          .called
      })

      it('should not destroy the files in filestore', function () {
        expect(this.FileStoreHandler.promises.deleteProject).to.not.have.been
          .called
      })

      it('should not destroy the chat threads and messages', function () {
        expect(this.ChatApiHandler.promises.destroyProject).to.not.have.been
          .called
      })
    })
  })

  describe('archiveProject', function () {
    beforeEach(function () {
      const archived = [new ObjectId(this.user._id)]
      this.ProjectHelper.calculateArchivedArray.returns(archived)

      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project._id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: this.project._id },
          {
            $set: { archived },
            $pull: { trashed: new ObjectId(this.user._id) },
          }
        )
        .resolves()
    })

    it('should update the project', async function () {
      await this.ProjectDeleter.promises.archiveProject(
        this.project._id,
        this.user._id
      )
      this.ProjectMock.verify()
    })

    it('calculates the archived array', async function () {
      await this.ProjectDeleter.promises.archiveProject(
        this.project._id,
        this.user._id
      )
      expect(this.ProjectHelper.calculateArchivedArray).to.have.been.calledWith(
        this.project,
        this.user._id,
        'ARCHIVE'
      )
    })
  })

  describe('unarchiveProject', function () {
    beforeEach(function () {
      const archived = [new ObjectId(this.user._id)]
      this.ProjectHelper.calculateArchivedArray.returns(archived)

      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project._id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('updateOne')
        .withArgs({ _id: this.project._id }, { $set: { archived } })
        .resolves()
    })

    it('should update the project', async function () {
      await this.ProjectDeleter.promises.unarchiveProject(
        this.project._id,
        this.user._id
      )
      this.ProjectMock.verify()
    })

    it('calculates the archived array', async function () {
      await this.ProjectDeleter.promises.unarchiveProject(
        this.project._id,
        this.user._id
      )
      expect(this.ProjectHelper.calculateArchivedArray).to.have.been.calledWith(
        this.project,
        this.user._id,
        'UNARCHIVE'
      )
    })
  })

  describe('trashProject', function () {
    beforeEach(function () {
      const archived = [new ObjectId(this.user._id)]
      this.ProjectHelper.calculateArchivedArray.returns(archived)

      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project._id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: this.project._id },
          {
            $addToSet: { trashed: new ObjectId(this.user._id) },
            $set: { archived },
          }
        )
        .resolves()
    })

    it('should update the project', async function () {
      await this.ProjectDeleter.promises.trashProject(
        this.project._id,
        this.user._id
      )
      this.ProjectMock.verify()
    })

    it('unarchives the project', async function () {
      await this.ProjectDeleter.promises.trashProject(
        this.project._id,
        this.user._id
      )
      expect(this.ProjectHelper.calculateArchivedArray).to.have.been.calledWith(
        this.project,
        this.user._id,
        'UNARCHIVE'
      )
    })
  })

  describe('untrashProject', function () {
    beforeEach(function () {
      this.ProjectMock.expects('findOne')
        .withArgs({ _id: this.project._id })
        .chain('exec')
        .resolves(this.project)

      this.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: this.project._id },
          { $pull: { trashed: new ObjectId(this.user._id) } }
        )
        .resolves()
    })

    it('should update the project', async function () {
      await this.ProjectDeleter.promises.untrashProject(
        this.project._id,
        this.user._id
      )
      this.ProjectMock.verify()
    })
  })

  describe('restoreProject', function () {
    beforeEach(function () {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: this.project._id,
          },
          {
            $unset: { archived: true },
          }
        )
        .chain('exec')
        .resolves()
    })

    it('should unset the archive attribute', async function () {
      await this.ProjectDeleter.promises.restoreProject(this.project._id)
    })
  })

  describe('undeleteProject', function () {
    beforeEach(function () {
      this.unknownProjectId = new ObjectId()
      this.purgedProjectId = new ObjectId()

      this.deletedProject = {
        _id: 'deleted',
        project: this.project,
        deleterData: {
          deletedProjectId: this.project._id,
          deletedProjectOwnerId: this.project.owner_ref,
        },
      }
      this.purgedProject = {
        _id: 'purged',
        deleterData: {
          deletedProjectId: this.purgedProjectId,
          deletedProjectOwnerId: 'potato',
        },
      }

      this.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': this.project._id })
        .chain('exec')
        .resolves(this.deletedProject)
      this.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': this.purgedProjectId })
        .chain('exec')
        .resolves(this.purgedProject)
      this.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': this.unknownProjectId })
        .chain('exec')
        .resolves(null)
      this.DeletedProjectMock.expects('deleteOne').chain('exec').resolves()
    })

    it('should return not found if the project does not exist', async function () {
      await expect(
        this.ProjectDeleter.promises.undeleteProject(
          this.unknownProjectId.toString()
        )
      ).to.be.rejectedWith(Errors.NotFoundError, 'project_not_found')
    })

    it('should return not found if the project has been expired', async function () {
      await expect(
        this.ProjectDeleter.promises.undeleteProject(
          this.purgedProjectId.toString()
        )
      ).to.be.rejectedWith(Errors.NotFoundError, 'project_too_old_to_restore')
    })

    it('should insert the project into the collection', async function () {
      await this.ProjectDeleter.promises.undeleteProject(this.project._id)
      sinon.assert.calledWith(
        this.db.projects.insertOne,
        sinon.match({
          _id: this.project._id,
          name: this.project.name,
        })
      )
    })

    it('should clear the archive bit', async function () {
      this.project.archived = true
      await this.ProjectDeleter.promises.undeleteProject(this.project._id)
      sinon.assert.calledWith(
        this.db.projects.insertOne,
        sinon.match({ archived: undefined })
      )
    })

    it('should generate a unique name for the project', async function () {
      await this.ProjectDeleter.promises.undeleteProject(this.project._id)
      sinon.assert.calledWith(
        this.ProjectDetailsHandler.promises.generateUniqueName,
        this.project.owner_ref
      )
    })

    it('should add a suffix to the project name', async function () {
      await this.ProjectDeleter.promises.undeleteProject(this.project._id)
      sinon.assert.calledWith(
        this.ProjectDetailsHandler.promises.generateUniqueName,
        this.project.owner_ref,
        this.project.name + ' (Restored)'
      )
    })

    it('should remove the DeletedProject', async function () {
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

      await this.ProjectDeleter.promises.undeleteProject(this.project._id)
      this.DeletedProjectMock.verify()
    })
  })
})

function dummyProject() {
  return {
    _id: new ObjectId(),
    lastUpdated: new Date(),
    rootFolder: [],
    collaberator_refs: [new ObjectId(), new ObjectId()],
    readOnly_refs: [new ObjectId(), new ObjectId()],
    tokenAccessReadAndWrite_refs: [new ObjectId(), new ObjectId()],
    tokenAccessReadOnly_refs: [new ObjectId(), new ObjectId()],
    owner_ref: new ObjectId(),
    tokens: {
      readOnly: 'wombat',
      readAndWrite: 'potato',
    },
    overleaf: {
      id: 1234,
      history: {
        id: 5678,
      },
    },
    name: 'a very scientific analysis of spooky ghosts',
  }
}
