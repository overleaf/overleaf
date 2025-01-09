const { promisify } = require('util')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const { Project } = require('../helpers/models/Project')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Collaborators/CollaboratorsHandler'
)

const sleep = promisify(setTimeout)

describe('CollaboratorsHandler', function () {
  beforeEach(function () {
    this.userId = new ObjectId()
    this.addingUserId = new ObjectId()
    this.project = {
      _id: new ObjectId(),
      owner_ref: this.addingUserId,
      name: 'Foo',
    }

    this.archivedProject = {
      _id: new ObjectId(),
      archived: [new ObjectId(this.userId)],
    }

    this.oldArchivedProject = {
      _id: new ObjectId(),
      archived: true,
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }
    this.ContactManager = {
      addContact: sinon.stub(),
    }
    this.ProjectMock = sinon.mock(Project)
    this.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }
    this.TpdsUpdateSender = {
      promises: {
        createProject: sinon.stub().resolves(),
      },
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }

    this.ProjectHelper = {
      calculateArchivedArray: sinon.stub(),
    }
    this.CollaboratorsGetter = {
      promises: {
        dangerouslyGetAllProjectsUserIsMemberOf: sinon.stub(),
        getMemberIdsWithPrivilegeLevels: sinon.stub().resolves([]),
      },
    }
    this.EditorRealTimeController = { emitToRoom: sinon.stub() }
    this.CollaboratorsHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../Contacts/ContactManager': this.ContactManager,
        '../../models/Project': { Project },
        '../ThirdPartyDataStore/TpdsProjectFlusher': this.TpdsProjectFlusher,
        '../ThirdPartyDataStore/TpdsUpdateSender': this.TpdsUpdateSender,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Project/ProjectHelper': this.ProjectHelper,
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        './CollaboratorsGetter': this.CollaboratorsGetter,
      },
    })
  })

  afterEach(function () {
    this.ProjectMock.verify()
  })

  describe('removeUserFromProject', function () {
    describe('a non-archived project', function () {
      beforeEach(function () {
        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: this.project._id,
          })
          .chain('exec')
          .resolves(this.project)
      })

      it('should remove the user from mongo', async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.project._id,
            },
            {
              $pull: {
                collaberator_refs: this.userId,
                reviewer_refs: this.userId,
                readOnly_refs: this.userId,
                pendingEditor_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                archived: this.userId,
                trashed: this.userId,
              },
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

    describe('an archived project, archived with a boolean value', function () {
      beforeEach(function () {
        const archived = [new ObjectId(this.userId)]
        this.ProjectHelper.calculateArchivedArray.returns(archived)

        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: this.oldArchivedProject._id,
          })
          .chain('exec')
          .resolves(this.oldArchivedProject)
      })

      it('should remove the user from mongo', async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.oldArchivedProject._id,
            },
            {
              $set: {
                archived: [],
              },
              $pull: {
                collaberator_refs: this.userId,
                reviewer_refs: this.userId,
                readOnly_refs: this.userId,
                pendingEditor_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                trashed: this.userId,
              },
            }
          )
          .resolves()
        await this.CollaboratorsHandler.promises.removeUserFromProject(
          this.oldArchivedProject._id,
          this.userId
        )
      })
    })

    describe('an archived project, archived with an array value', function () {
      beforeEach(function () {
        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: this.archivedProject._id,
          })
          .chain('exec')
          .resolves(this.archivedProject)
      })

      it('should remove the user from mongo', async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.archivedProject._id,
            },
            {
              $pull: {
                collaberator_refs: this.userId,
                reviewer_refs: this.userId,
                readOnly_refs: this.userId,
                pendingEditor_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                archived: this.userId,
                trashed: this.userId,
              },
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

  describe('addUserIdToProject', function () {
    describe('as readOnly', function () {
      beforeEach(async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.project._id,
            },
            {
              $addToSet: { readOnly_refs: this.userId },
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

      it('should create the project folder in dropbox', function () {
        expect(
          this.TpdsUpdateSender.promises.createProject
        ).to.have.been.calledWith({
          projectId: this.project._id,
          projectName: this.project.name,
          ownerId: this.addingUserId,
          userId: this.userId,
        })
      })

      it('should flush the project to the TPDS', function () {
        expect(
          this.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(this.project._id)
      })

      it('should add the user as a contact for the adding user', function () {
        expect(this.ContactManager.addContact).to.have.been.calledWith(
          this.addingUserId,
          this.userId
        )
      })

      describe('and with pendingEditor flag', function () {
        it('should add them to the pending editor refs', async function () {
          this.ProjectMock.expects('updateOne')
            .withArgs(
              {
                _id: this.project._id,
              },
              {
                $addToSet: {
                  readOnly_refs: this.userId,
                  pendingEditor_refs: this.userId,
                },
              }
            )
            .chain('exec')
            .resolves()
          await this.CollaboratorsHandler.promises.addUserIdToProject(
            this.project._id,
            this.addingUserId,
            this.userId,
            'readOnly',
            { pendingEditor: true }
          )
        })
      })
    })

    describe('as readAndWrite', function () {
      beforeEach(async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.project._id,
            },
            {
              $addToSet: { collaberator_refs: this.userId },
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

      it('should flush the project to the TPDS', function () {
        expect(
          this.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(this.project._id)
      })
    })

    describe('as reviewer', function () {
      beforeEach(async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.project._id,
            },
            {
              track_changes: { [this.userId]: true },
              $addToSet: { reviewer_refs: this.userId },
            }
          )
          .chain('exec')
          .resolves()
        await this.CollaboratorsHandler.promises.addUserIdToProject(
          this.project._id,
          this.addingUserId,
          this.userId,
          'review'
        )
      })

      it('should update the client with new track changes settings', function () {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project._id, 'toggle-track-changes', {
            [this.userId]: true,
          })
          .should.equal(true)
      })

      it('should flush the project to the TPDS', function () {
        expect(
          this.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(this.project._id)
      })
    })

    describe('with invalid privilegeLevel', function () {
      it('should call the callback with an error', async function () {
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

    describe('when user already exists as a collaborator', function () {
      beforeEach(function () {
        this.project.collaberator_refs = [this.userId]
      })

      it('should not add the user again', async function () {
        await this.CollaboratorsHandler.promises.addUserIdToProject(
          this.project._id,
          this.addingUserId,
          this.userId,
          'readAndWrite'
        )
        // Project.updateOne() should not be called. If it is, it will fail because
        // the mock is not set up.
      })
    })

    describe('with null addingUserId', function () {
      beforeEach(async function () {
        this.project.collaberator_refs = []
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.project._id,
            },
            {
              $addToSet: { collaberator_refs: this.userId },
            }
          )
          .chain('exec')
          .resolves()
        await this.CollaboratorsHandler.promises.addUserIdToProject(
          this.project._id,
          null,
          this.userId,
          'readAndWrite'
        )
      })

      it('should not add the adding user as a contact', function () {
        expect(this.ContactManager.addContact).not.to.have.been.called
      })
    })
  })

  describe('removeUserFromAllProjects', function () {
    it('should remove the user from each project', async function () {
      this.CollaboratorsGetter.promises.dangerouslyGetAllProjectsUserIsMemberOf
        .withArgs(this.userId, { _id: 1 })
        .resolves({
          readAndWrite: [
            { _id: 'read-and-write-0' },
            { _id: 'read-and-write-1' },
          ],
          readOnly: [{ _id: 'read-only-0' }, { _id: 'read-only-1' }],
          tokenReadAndWrite: [
            { _id: 'token-read-and-write-0' },
            { _id: 'token-read-and-write-1' },
          ],
          tokenReadOnly: [
            { _id: 'token-read-only-0' },
            { _id: 'token-read-only-1' },
          ],
        })
      const expectedProjects = [
        'read-and-write-0',
        'read-and-write-1',
        'read-only-0',
        'read-only-1',
        'token-read-and-write-0',
        'token-read-and-write-1',
        'token-read-only-0',
        'token-read-only-1',
      ]
      for (const projectId of expectedProjects) {
        this.ProjectMock.expects('findOne')
          .withArgs({
            _id: projectId,
          })
          .chain('exec')
          .resolves({ _id: projectId })

        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: projectId,
            },
            {
              $pull: {
                collaberator_refs: this.userId,
                reviewer_refs: this.userId,
                readOnly_refs: this.userId,
                pendingEditor_refs: this.userId,
                tokenAccessReadOnly_refs: this.userId,
                tokenAccessReadAndWrite_refs: this.userId,
                archived: this.userId,
                trashed: this.userId,
              },
            }
          )
          .resolves()
      }
      await this.CollaboratorsHandler.promises.removeUserFromAllProjects(
        this.userId
      )
    })
  })

  describe('transferProjects', function () {
    beforeEach(function () {
      this.fromUserId = new ObjectId()
      this.toUserId = new ObjectId()
      this.projects = [
        {
          _id: new ObjectId(),
        },
        {
          _id: new ObjectId(),
        },
      ]
      this.ProjectMock.expects('find')
        .withArgs({
          $or: [
            { owner_ref: this.fromUserId },
            { collaberator_refs: this.fromUserId },
            { readOnly_refs: this.fromUserId },
          ],
        })
        .chain('exec')
        .resolves(this.projects)
      this.ProjectMock.expects('updateMany')
        .withArgs(
          { owner_ref: this.fromUserId },
          { $set: { owner_ref: this.toUserId } }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('updateMany')
        .withArgs(
          { collaberator_refs: this.fromUserId },
          {
            $addToSet: { collaberator_refs: this.toUserId },
          }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('updateMany')
        .withArgs(
          { collaberator_refs: this.fromUserId },
          {
            $pull: { collaberator_refs: this.fromUserId },
          }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('updateMany')
        .withArgs(
          { readOnly_refs: this.fromUserId },
          {
            $addToSet: { readOnly_refs: this.toUserId },
          }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('updateMany')
        .withArgs(
          { readOnly_refs: this.fromUserId },
          {
            $pull: { readOnly_refs: this.fromUserId },
          }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('updateMany')
        .withArgs(
          { pendingEditor_refs: this.fromUserId },
          {
            $addToSet: { pendingEditor_refs: this.toUserId },
          }
        )
        .chain('exec')
        .resolves()
      this.ProjectMock.expects('updateMany')
        .withArgs(
          { pendingEditor_refs: this.fromUserId },
          {
            $pull: { pendingEditor_refs: this.fromUserId },
          }
        )
        .chain('exec')
        .resolves()
    })

    describe('successfully', function () {
      it('should flush each project to the TPDS', async function () {
        await this.CollaboratorsHandler.promises.transferProjects(
          this.fromUserId,
          this.toUserId
        )
        await sleep(10) // let the background tasks run
        for (const project of this.projects) {
          expect(
            this.TpdsProjectFlusher.promises.flushProjectToTpds
          ).to.have.been.calledWith(project._id)
        }
      })
    })

    describe('when flushing to TPDS fails', function () {
      it('should log an error but not fail', async function () {
        this.TpdsProjectFlusher.promises.flushProjectToTpds.rejects(
          new Error('oops')
        )
        await this.CollaboratorsHandler.promises.transferProjects(
          this.fromUserId,
          this.toUserId
        )
        await sleep(10) // let the background tasks run
        expect(this.logger.err).to.have.been.called
      })
    })
  })

  describe('setCollaboratorPrivilegeLevel', function () {
    it('sets a collaborator to read-only', async function () {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: this.projectId,
            $or: [
              { collaberator_refs: this.userId },
              { readOnly_refs: this.userId },
              { reviewer_refs: this.userId },
            ],
          },
          {
            $pull: {
              collaberator_refs: this.userId,
              pendingEditor_refs: this.userId,
              reviewer_refs: this.userId,
            },
            $addToSet: { readOnly_refs: this.userId },
          }
        )
        .chain('exec')
        .resolves({ matchedCount: 1 })
      await this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        this.projectId,
        this.userId,
        'readOnly'
      )
    })

    it('sets a collaborator to read-write', async function () {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: this.projectId,
            $or: [
              { collaberator_refs: this.userId },
              { readOnly_refs: this.userId },
              { reviewer_refs: this.userId },
            ],
          },
          {
            $addToSet: { collaberator_refs: this.userId },
            $pull: {
              readOnly_refs: this.userId,
              reviewer_refs: this.userId,
              pendingEditor_refs: this.userId,
            },
          }
        )
        .chain('exec')
        .resolves({ matchedCount: 1 })
      await this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        this.projectId,
        this.userId,
        'readAndWrite'
      )
    })

    describe('sets a collaborator to reviewer when track changes is enabled for everyone', function () {
      beforeEach(function () {
        this.ProjectGetter.promises.getProject = sinon.stub().resolves({
          _id: new ObjectId(),
          owner_ref: this.addingUserId,
          name: 'Foo',
          track_changes: true,
        })
      })
      it('should correctly update the project', async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.projectId,
              $or: [
                { collaberator_refs: this.userId },
                { readOnly_refs: this.userId },
                { reviewer_refs: this.userId },
              ],
            },
            {
              $addToSet: { reviewer_refs: this.userId },
              $set: { track_changes: { [this.userId]: true } },
              $pull: {
                readOnly_refs: this.userId,
                collaberator_refs: this.userId,
                pendingEditor_refs: this.userId,
              },
            }
          )
          .chain('exec')
          .resolves({ matchedCount: 1 })
        await this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
          this.projectId,
          this.userId,
          'review'
        )
      })
    })

    describe('sets a collaborator to reviewer when track changes is not enabled for everyone', function () {
      beforeEach(function () {
        this.ProjectGetter.promises.getProject = sinon.stub().resolves({
          _id: new ObjectId(),
          owner_ref: this.addingUserId,
          name: 'Foo',
          track_changes: {
            [this.userId]: true,
          },
        })
      })
      it('should correctly update the project', async function () {
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.projectId,
              $or: [
                { collaberator_refs: this.userId },
                { readOnly_refs: this.userId },
                { reviewer_refs: this.userId },
              ],
            },
            {
              $addToSet: { reviewer_refs: this.userId },
              $set: { [`track_changes.${this.userId}`]: true },
              $pull: {
                readOnly_refs: this.userId,
                collaberator_refs: this.userId,
                pendingEditor_refs: this.userId,
              },
            }
          )
          .chain('exec')
          .resolves({ matchedCount: 1 })
        await this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
          this.projectId,
          this.userId,
          'review'
        )
      })
    })

    it('sets a collaborator to read-only as a pendingEditor', async function () {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: this.projectId,
            $or: [
              { collaberator_refs: this.userId },
              { readOnly_refs: this.userId },
              { reviewer_refs: this.userId },
            ],
          },
          {
            $addToSet: {
              readOnly_refs: this.userId,
              pendingEditor_refs: this.userId,
            },
            $pull: {
              collaberator_refs: this.userId,
              reviewer_refs: this.userId,
            },
          }
        )
        .chain('exec')
        .resolves({ matchedCount: 1 })
      await this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        this.projectId,
        this.userId,
        'readOnly',
        { pendingEditor: true }
      )
    })

    it('throws a NotFoundError if the project or collaborator does not exist', async function () {
      this.ProjectMock.expects('updateOne')
        .chain('exec')
        .resolves({ matchedCount: 0 })
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
