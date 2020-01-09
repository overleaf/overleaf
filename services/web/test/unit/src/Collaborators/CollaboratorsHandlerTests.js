const { promisify } = require('util')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const { Project } = require('../helpers/models/Project')
const { ObjectId } = require('mongojs')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Collaborators/CollaboratorsHandler'
)

const sleep = promisify(setTimeout)

describe('CollaboratorsHandler', function() {
  beforeEach(function() {
    this.logger = {
      log: sinon.stub(),
      warn: sinon.stub(),
      err: sinon.stub()
    }
    this.userId = ObjectId()
    this.addingUserId = ObjectId()
    this.project = {
      _id: ObjectId()
    }

    this.archivedProject = {
      _id: ObjectId(),
      archived: [ObjectId(this.userId)]
    }

    this.oldArchivedProject = {
      _id: ObjectId(),
      archived: true
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null)
      }
    }
    this.ContactManager = {
      addContact: sinon.stub()
    }
    this.ProjectMock = sinon.mock(Project)
    this.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves()
      }
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project)
      }
    }

    this.ProjectHelper = {
      calculateArchivedArray: sinon.stub()
    }
    this.CollaboratorsGetter = {
      promises: {
        getProjectsUserIsMemberOf: sinon.stub()
      }
    }
    this.CollaboratorsHandler = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': this.logger,
        '../User/UserGetter': this.UserGetter,
        '../Contacts/ContactManager': this.ContactManager,
        '../../models/Project': { Project },
        '../ThirdPartyDataStore/TpdsProjectFlusher': this.TpdsProjectFlusher,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Project/ProjectHelper': this.ProjectHelper,
        '../Errors/Errors': Errors,
        './CollaboratorsGetter': this.CollaboratorsGetter
      }
    })
  })

  afterEach(function() {
    this.ProjectMock.verify()
  })

  describe('removeUserFromProject', function() {
    describe('a non-archived project', function() {
      beforeEach(function() {
        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: this.project._id
          })
          .chain('exec')
          .resolves(this.project)
      })

      it('should remove the user from mongo', async function() {
        this.ProjectMock.expects('update')
          .withArgs(
            {
              _id: this.project._id
            },
            {
              $pull: {
                collaberator_refs: this.userId,
                readOnly_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                archived: this.userId,
                trashed: this.userId
              }
            }
          )
          .chain('exec')
          .resolves()
        await this.CollaboratorsHandler.promises.removeUserFromProject(
          this.project._id,
          this.userId
        )
      })
    })

    describe('an archived project, archived with a boolean value', function() {
      beforeEach(function() {
        let archived = [ObjectId(this.userId)]
        this.ProjectHelper.calculateArchivedArray.returns(archived)

        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: this.oldArchivedProject._id
          })
          .chain('exec')
          .resolves(this.oldArchivedProject)
      })

      it('should remove the user from mongo', async function() {
        this.ProjectMock.expects('update')
          .withArgs(
            {
              _id: this.oldArchivedProject._id
            },
            {
              $set: {
                archived: []
              },
              $pull: {
                collaberator_refs: this.userId,
                readOnly_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                trashed: this.userId
              }
            }
          )
          .resolves()
        await this.CollaboratorsHandler.promises.removeUserFromProject(
          this.oldArchivedProject._id,
          this.userId
        )
      })
    })

    describe('an archived project, archived with an array value', function() {
      beforeEach(function() {
        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: this.archivedProject._id
          })
          .chain('exec')
          .resolves(this.archivedProject)
      })

      it('should remove the user from mongo', async function() {
        this.ProjectMock.expects('update')
          .withArgs(
            {
              _id: this.archivedProject._id
            },
            {
              $pull: {
                collaberator_refs: this.userId,
                readOnly_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                archived: this.userId,
                trashed: this.userId
              }
            }
          )
          .resolves()
        await this.CollaboratorsHandler.promises.removeUserFromProject(
          this.archivedProject._id,
          this.userId
        )
      })
    })
  })

  describe('addUserIdToProject', function() {
    describe('as readOnly', function() {
      beforeEach(async function() {
        this.ProjectMock.expects('update')
          .withArgs(
            {
              _id: this.project._id
            },
            {
              $addToSet: { readOnly_refs: this.userId }
            }
          )
          .chain('exec')
          .resolves()
        await this.CollaboratorsHandler.promises.addUserIdToProject(
          this.project._id,
          this.addingUserId,
          this.userId,
          'readOnly'
        )
      })

      it('should flush the project to the TPDS', function() {
        expect(
          this.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(this.project._id)
      })

      it('should add the user as a contact for the adding user', function() {
        expect(this.ContactManager.addContact).to.have.been.calledWith(
          this.addingUserId,
          this.userId
        )
      })
    })

    describe('as readAndWrite', function() {
      beforeEach(async function() {
        this.ProjectMock.expects('update')
          .withArgs(
            {
              _id: this.project._id
            },
            {
              $addToSet: { collaberator_refs: this.userId }
            }
          )
          .chain('exec')
          .resolves()
        await this.CollaboratorsHandler.promises.addUserIdToProject(
          this.project._id,
          this.addingUserId,
          this.userId,
          'readAndWrite'
        )
      })

      it('should flush the project to the TPDS', function() {
        expect(
          this.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(this.project._id)
      })
    })

    describe('with invalid privilegeLevel', function() {
      it('should call the callback with an error', async function() {
        await expect(
          this.CollaboratorsHandler.promises.addUserIdToProject(
            this.project._id,
            this.addingUserId,
            this.userId,
            'notValid'
          )
        ).to.be.rejected
      })
    })

    describe('when user already exists as a collaborator', function() {
      beforeEach(function() {
        this.project.collaberator_refs = [this.userId]
      })

      it('should not add the user again', async function() {
        await this.CollaboratorsHandler.promises.addUserIdToProject(
          this.project._id,
          this.addingUserId,
          this.userId,
          'readAndWrite'
        )
        // Project.update() should not be called. If it is, it will fail because
        // the mock is not set up.
      })
    })

    describe('with null addingUserId', function() {
      beforeEach(function() {
        this.CollaboratorsHandler.promises.addUserIdToProject(
          this.project._id,
          null,
          this.userId,
          'readAndWrite',
          this.callback
        )
      })

      it('should not add the adding user as a contact', function() {
        expect(this.ContactManager.addContact).not.to.have.been.called
      })
    })
  })

  describe('removeUserFromAllProjects', function() {
    it('should remove the user from each project', async function() {
      this.CollaboratorsGetter.promises.getProjectsUserIsMemberOf
        .withArgs(this.userId, { _id: 1 })
        .resolves({
          readAndWrite: [
            { _id: 'read-and-write-0' },
            { _id: 'read-and-write-1' }
          ],
          readOnly: [{ _id: 'read-only-0' }, { _id: 'read-only-1' }],
          tokenReadAndWrite: [
            { _id: 'token-read-and-write-0' },
            { _id: 'token-read-and-write-1' }
          ],
          tokenReadOnly: [
            { _id: 'token-read-only-0' },
            { _id: 'token-read-only-1' }
          ]
        })
      const expectedProjects = [
        'read-and-write-0',
        'read-and-write-1',
        'read-only-0',
        'read-only-1',
        'token-read-and-write-0',
        'token-read-and-write-1',
        'token-read-only-0',
        'token-read-only-1'
      ]
      for (const projectId of expectedProjects) {
        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: projectId
          })
          .chain('exec')
          .resolves({ _id: projectId })

        this.ProjectMock.expects('update')
          .withArgs(
            {
              _id: projectId
            },
            {
              $pull: {
                collaberator_refs: this.userId,
                readOnly_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                archived: this.userId,
                trashed: this.userId
              }
            }
          )
          .resolves()
      }
      await this.CollaboratorsHandler.promises.removeUserFromAllProjects(
        this.userId
      )
    })
  })

  describe('transferProjects', function() {
    beforeEach(function() {
      this.fromUserId = ObjectId()
      this.toUserId = ObjectId()
      this.projects = [
        {
          _id: ObjectId()
        },
        {
          _id: ObjectId()
        }
      ]
      this.ProjectMock.expects('find')
        .withArgs({
          $or: [
            { owner_ref: this.fromUserId },
            { collaberator_refs: this.fromUserId },
            { readOnly_refs: this.fromUserId }
          ]
        })
        .chain('exec')
        .resolves(this.projects)
      this.ProjectMock.expects('update')
        .withArgs(
          { owner_ref: this.fromUserId },
          { $set: { owner_ref: this.toUserId } },
          { multi: true }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('update')
        .withArgs(
          { collaberator_refs: this.fromUserId },
          {
            $addToSet: { collaberator_refs: this.toUserId }
          },
          { multi: true }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('update')
        .withArgs(
          { collaberator_refs: this.fromUserId },
          {
            $pull: { collaberator_refs: this.fromUserId }
          },
          { multi: true }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('update')
        .withArgs(
          { readOnly_refs: this.fromUserId },
          {
            $addToSet: { readOnly_refs: this.toUserId }
          },
          { multi: true }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('update')
        .withArgs(
          { readOnly_refs: this.fromUserId },
          {
            $pull: { readOnly_refs: this.fromUserId }
          },
          { multi: true }
        )
        .chain('exec')
        .resolves()
    })

    describe('successfully', function() {
      it('should flush each project to the TPDS', async function() {
        await this.CollaboratorsHandler.promises.transferProjects(
          this.fromUserId,
          this.toUserId
        )
        await sleep(100) // let the background tasks run
        for (const project of this.projects) {
          expect(
            this.TpdsProjectFlusher.promises.flushProjectToTpds
          ).to.have.been.calledWith(project._id)
        }
      })
    })

    describe('when flushing to TPDS fails', function() {
      it('should log an error but not fail', async function() {
        this.TpdsProjectFlusher.promises.flushProjectToTpds.rejects(
          new Error('oops')
        )
        await this.CollaboratorsHandler.promises.transferProjects(
          this.fromUserId,
          this.toUserId
        )
        await sleep(100) // let the background tasks run
        expect(this.logger.err).to.have.been.called
      })
    })
  })

  describe('setCollaboratorPrivilegeLevel', function() {
    it('sets a collaborator to read-only', async function() {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: this.projectId,
            $or: [
              { collaberator_refs: this.userId },
              { readOnly_refs: this.userId }
            ]
          },
          {
            $pull: { collaberator_refs: this.userId },
            $addToSet: { readOnly_refs: this.userId }
          }
        )
        .chain('exec')
        .resolves({ n: 1 })
      await this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        this.projectId,
        this.userId,
        'readOnly'
      )
    })

    it('sets a collaborator to read-write', async function() {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: this.projectId,
            $or: [
              { collaberator_refs: this.userId },
              { readOnly_refs: this.userId }
            ]
          },
          {
            $addToSet: { collaberator_refs: this.userId },
            $pull: { readOnly_refs: this.userId }
          }
        )
        .chain('exec')
        .resolves({ n: 1 })
      await this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        this.projectId,
        this.userId,
        'readAndWrite'
      )
    })

    it('throws a NotFoundError if the project or collaborator does not exist', async function() {
      this.ProjectMock.expects('updateOne')
        .chain('exec')
        .resolves({ n: 0 })
      await expect(
        this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
          this.projectId,
          this.userId,
          'readAndWrite'
        )
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })
})
