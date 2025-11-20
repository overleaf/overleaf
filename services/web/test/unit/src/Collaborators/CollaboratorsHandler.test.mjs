import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import { Project } from '../../../../app/src/models/Project.mjs'
import mongodb from 'mongodb-legacy'
import { setTimeout } from 'node:timers/promises'

const { ObjectId } = mongodb
vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)
const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Collaborators/CollaboratorsHandler'
)

const sleep = setTimeout

describe('CollaboratorsHandler', function () {
  beforeEach(async function (ctx) {
    ctx.userId = new ObjectId()
    ctx.addingUserId = new ObjectId()
    ctx.project = {
      _id: new ObjectId(),
      owner_ref: ctx.addingUserId,
      name: 'Foo',
    }

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }
    ctx.ContactManager = {
      addContact: sinon.stub(),
    }
    ctx.ProjectMock = sinon.mock(Project)
    ctx.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }
    ctx.TpdsUpdateSender = {
      promises: {
        createProject: sinon.stub().resolves(),
      },
    }
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }

    ctx.CollaboratorsGetter = {
      promises: {
        dangerouslyGetAllProjectsUserIsMemberOf: sinon.stub(),
        getMemberIdsWithPrivilegeLevels: sinon.stub().resolves([]),
      },
    }
    ctx.EditorRealTimeController = { emitToRoom: sinon.stub() }

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Contacts/ContactManager', () => ({
      default: ctx.ContactManager,
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project,
    }))

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher',
      () => ({
        default: ctx.TpdsProjectFlusher,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender',
      () => ({
        default: ctx.TpdsUpdateSender,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    ctx.CollaboratorsHandler = (await import(MODULE_PATH)).default
  })

  afterEach(function (ctx) {
    ctx.ProjectMock.verify()
  })

  describe('removeUserFromProject', function () {
    describe('a non-archived project', function () {
      it('should remove the user from mongo', async function (ctx) {
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
            },
            {
              $pull: {
                collaberator_refs: ctx.userId,
                reviewer_refs: ctx.userId,
                readOnly_refs: ctx.userId,
                pendingEditor_refs: ctx.userId,
                pendingReviewer_refs: ctx.userId,
                tokenAccessReadOnly_refs: ctx.userId,
                tokenAccessReadAndWrite_refs: ctx.userId,
                archived: ctx.userId,
                trashed: ctx.userId,
              },
            }
          )
          .chain('exec')
          .resolves()
        await ctx.CollaboratorsHandler.promises.removeUserFromProject(
          ctx.project._id,
          ctx.userId
        )
      })
    })
  })

  describe('addUserIdToProject', function () {
    describe('as readOnly', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
            },
            {
              $addToSet: { readOnly_refs: ctx.userId },
            }
          )
          .chain('exec')
          .resolves()
        await ctx.CollaboratorsHandler.promises.addUserIdToProject(
          ctx.project._id,
          ctx.addingUserId,
          ctx.userId,
          'readOnly'
        )
      })

      it('should create the project folder in dropbox', function (ctx) {
        expect(
          ctx.TpdsUpdateSender.promises.createProject
        ).to.have.been.calledWith({
          projectId: ctx.project._id,
          projectName: ctx.project.name,
          ownerId: ctx.addingUserId,
          userId: ctx.userId,
        })
      })

      it('should flush the project to the TPDS', function (ctx) {
        expect(
          ctx.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(ctx.project._id)
      })

      it('should add the user as a contact for the adding user', function (ctx) {
        expect(ctx.ContactManager.addContact).to.have.been.calledWith(
          ctx.addingUserId,
          ctx.userId
        )
      })

      describe('and with pendingEditor flag', function () {
        it('should add them to the pending editor refs', async function (ctx) {
          ctx.ProjectMock.expects('updateOne')
            .withArgs(
              {
                _id: ctx.project._id,
              },
              {
                $addToSet: {
                  readOnly_refs: ctx.userId,
                  pendingEditor_refs: ctx.userId,
                },
              }
            )
            .chain('exec')
            .resolves()
          await ctx.CollaboratorsHandler.promises.addUserIdToProject(
            ctx.project._id,
            ctx.addingUserId,
            ctx.userId,
            'readOnly',
            { pendingEditor: true }
          )
        })
      })

      describe('with pendingReviewer flag', function () {
        it('should add them to the pending reviewer refs', async function (ctx) {
          ctx.ProjectMock.expects('updateOne')
            .withArgs(
              {
                _id: ctx.project._id,
              },
              {
                $addToSet: {
                  readOnly_refs: ctx.userId,
                  pendingReviewer_refs: ctx.userId,
                },
              }
            )
            .chain('exec')
            .resolves()
          await ctx.CollaboratorsHandler.promises.addUserIdToProject(
            ctx.project._id,
            ctx.addingUserId,
            ctx.userId,
            'readOnly',
            { pendingReviewer: true }
          )
        })
      })
    })

    describe('as readAndWrite', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
            },
            {
              $addToSet: { collaberator_refs: ctx.userId },
            }
          )
          .chain('exec')
          .resolves()
        await ctx.CollaboratorsHandler.promises.addUserIdToProject(
          ctx.project._id,
          ctx.addingUserId,
          ctx.userId,
          'readAndWrite'
        )
      })

      it('should flush the project to the TPDS', function (ctx) {
        expect(
          ctx.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(ctx.project._id)
      })
    })

    describe('as reviewer', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
            },
            {
              track_changes: { [ctx.userId]: true },
              $addToSet: { reviewer_refs: ctx.userId },
            }
          )
          .chain('exec')
          .resolves()
        await ctx.CollaboratorsHandler.promises.addUserIdToProject(
          ctx.project._id,
          ctx.addingUserId,
          ctx.userId,
          'review'
        )
      })

      it('should update the client with new track changes settings', function (ctx) {
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(ctx.project._id, 'toggle-track-changes', {
            [ctx.userId]: true,
          })
          .should.equal(true)
      })

      it('should flush the project to the TPDS', function (ctx) {
        expect(
          ctx.TpdsProjectFlusher.promises.flushProjectToTpds
        ).to.have.been.calledWith(ctx.project._id)
      })
    })

    describe('with invalid privilegeLevel', function () {
      it('should call the callback with an error', async function (ctx) {
        await expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject(
            ctx.project._id,
            ctx.addingUserId,
            ctx.userId,
            'notValid'
          )
        ).to.be.rejected
      })
    })

    describe('when user already exists as a collaborator', function () {
      beforeEach(function (ctx) {
        ctx.project.collaberator_refs = [ctx.userId]
      })

      it('should not add the user again', async function (ctx) {
        await ctx.CollaboratorsHandler.promises.addUserIdToProject(
          ctx.project._id,
          ctx.addingUserId,
          ctx.userId,
          'readAndWrite'
        )
        // Project.updateOne() should not be called. If it is, it will fail because
        // the mock is not set up.
      })
    })

    describe('when user already exists as a reviewer', function () {
      beforeEach(function (ctx) {
        ctx.project.collaberator_refs = []
        ctx.project.reviewer_refs = [ctx.userId]
        ctx.project.readOnly_refs = []
      })

      it('should not add the user again', async function (ctx) {
        await ctx.CollaboratorsHandler.promises.addUserIdToProject(
          ctx.project._id,
          ctx.addingUserId,
          ctx.userId,
          'readAndWrite'
        )
      })
    })

    describe('when user already exists as a read-only user', function () {
      beforeEach(function (ctx) {
        ctx.project.collaberator_refs = []
        ctx.project.reviewer_refs = []
        ctx.project.readOnly_refs = [ctx.userId]
      })

      it('should not add the user again', async function (ctx) {
        await ctx.CollaboratorsHandler.promises.addUserIdToProject(
          ctx.project._id,
          ctx.addingUserId,
          ctx.userId,
          'readAndWrite'
        )
      })
    })

    describe('with null addingUserId', function () {
      beforeEach(async function (ctx) {
        ctx.project.collaberator_refs = []
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
            },
            {
              $addToSet: { collaberator_refs: ctx.userId },
            }
          )
          .chain('exec')
          .resolves()
        await ctx.CollaboratorsHandler.promises.addUserIdToProject(
          ctx.project._id,
          null,
          ctx.userId,
          'readAndWrite'
        )
      })

      it('should not add the adding user as a contact', function (ctx) {
        expect(ctx.ContactManager.addContact).not.to.have.been.called
      })
    })
  })

  describe('removeUserFromAllProjects', function () {
    it('should remove the user from each project', async function (ctx) {
      ctx.CollaboratorsGetter.promises.dangerouslyGetAllProjectsUserIsMemberOf
        .withArgs(ctx.userId, { _id: 1 })
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
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: projectId,
            },
            {
              $pull: {
                collaberator_refs: ctx.userId,
                reviewer_refs: ctx.userId,
                readOnly_refs: ctx.userId,
                pendingEditor_refs: ctx.userId,
                pendingReviewer_refs: ctx.userId,
                tokenAccessReadOnly_refs: ctx.userId,
                tokenAccessReadAndWrite_refs: ctx.userId,
                archived: ctx.userId,
                trashed: ctx.userId,
              },
            }
          )
          .resolves()
      }
      await ctx.CollaboratorsHandler.promises.removeUserFromAllProjects(
        ctx.userId
      )
    })
  })

  describe('transferProjects', function () {
    beforeEach(function (ctx) {
      ctx.fromUserId = new ObjectId()
      ctx.toUserId = new ObjectId()
      ctx.projects = [
        {
          _id: new ObjectId(),
        },
        {
          _id: new ObjectId(),
        },
      ]
      ctx.ProjectMock.expects('find')
        .withArgs({
          $or: [
            { owner_ref: ctx.fromUserId },
            { collaberator_refs: ctx.fromUserId },
            { readOnly_refs: ctx.fromUserId },
          ],
        })
        .chain('exec')
        .resolves(ctx.projects)
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { owner_ref: ctx.fromUserId },
          { $set: { owner_ref: ctx.toUserId } }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { collaberator_refs: ctx.fromUserId },
          {
            $addToSet: { collaberator_refs: ctx.toUserId },
          }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { collaberator_refs: ctx.fromUserId },
          {
            $pull: { collaberator_refs: ctx.fromUserId },
          }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { readOnly_refs: ctx.fromUserId },
          {
            $addToSet: { readOnly_refs: ctx.toUserId },
          }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { readOnly_refs: ctx.fromUserId },
          {
            $pull: { readOnly_refs: ctx.fromUserId },
          }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { pendingEditor_refs: ctx.fromUserId },
          {
            $addToSet: { pendingEditor_refs: ctx.toUserId },
          }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { pendingEditor_refs: ctx.fromUserId },
          {
            $pull: { pendingEditor_refs: ctx.fromUserId },
          }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { pendingReviewer_refs: ctx.fromUserId },
          {
            $addToSet: { pendingReviewer_refs: ctx.toUserId },
          }
        )
        .chain('exec')
        .resolves()
      ctx.ProjectMock.expects('updateMany')
        .withArgs(
          { pendingReviewer_refs: ctx.fromUserId },
          {
            $pull: { pendingReviewer_refs: ctx.fromUserId },
          }
        )
        .chain('exec')
        .resolves()
    })

    describe('successfully', function () {
      it('should flush each project to the TPDS', async function (ctx) {
        await ctx.CollaboratorsHandler.promises.transferProjects(
          ctx.fromUserId,
          ctx.toUserId
        )
        await sleep(10) // let the background tasks run
        for (const project of ctx.projects) {
          expect(
            ctx.TpdsProjectFlusher.promises.flushProjectToTpds
          ).to.have.been.calledWith(project._id)
        }
      })
    })

    describe('when flushing to TPDS fails', function () {
      it('should log an error but not fail', async function (ctx) {
        ctx.TpdsProjectFlusher.promises.flushProjectToTpds.rejects(
          new Error('oops')
        )
        await ctx.CollaboratorsHandler.promises.transferProjects(
          ctx.fromUserId,
          ctx.toUserId
        )
        await sleep(10) // let the background tasks run
        expect(ctx.logger.err).toHaveBeenCalled()
      })
    })
  })

  describe('setCollaboratorPrivilegeLevel', function () {
    it('sets a collaborator to read-only', async function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: ctx.project._id,
            $or: [
              { collaberator_refs: ctx.userId },
              { readOnly_refs: ctx.userId },
              { reviewer_refs: ctx.userId },
            ],
          },
          {
            $pull: {
              collaberator_refs: ctx.userId,
              pendingEditor_refs: ctx.userId,
              pendingReviewer_refs: ctx.userId,
              reviewer_refs: ctx.userId,
            },
            $addToSet: { readOnly_refs: ctx.userId },
          }
        )
        .chain('exec')
        .resolves({ matchedCount: 1 })
      await ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        ctx.project._id,
        ctx.userId,
        'readOnly'
      )
    })

    it('sets a collaborator to read-write', async function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: ctx.project._id,
            $or: [
              { collaberator_refs: ctx.userId },
              { readOnly_refs: ctx.userId },
              { reviewer_refs: ctx.userId },
            ],
          },
          {
            $addToSet: { collaberator_refs: ctx.userId },
            $pull: {
              readOnly_refs: ctx.userId,
              reviewer_refs: ctx.userId,
              pendingEditor_refs: ctx.userId,
              pendingReviewer_refs: ctx.userId,
            },
          }
        )
        .chain('exec')
        .resolves({ matchedCount: 1 })
      await ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        ctx.project._id,
        ctx.userId,
        'readAndWrite'
      )
    })

    describe('sets a collaborator to reviewer when track changes is enabled for everyone', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.promises.getProject = sinon.stub().resolves({
          _id: new ObjectId(),
          owner_ref: ctx.addingUserId,
          name: 'Foo',
          track_changes: true,
        })
      })
      it('should correctly update the project', async function (ctx) {
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
              $or: [
                { collaberator_refs: ctx.userId },
                { readOnly_refs: ctx.userId },
                { reviewer_refs: ctx.userId },
              ],
            },
            {
              $addToSet: { reviewer_refs: ctx.userId },
              $set: { track_changes: { [ctx.userId]: true } },
              $pull: {
                readOnly_refs: ctx.userId,
                collaberator_refs: ctx.userId,
                pendingEditor_refs: ctx.userId,
                pendingReviewer_refs: ctx.userId,
              },
            }
          )
          .chain('exec')
          .resolves({ matchedCount: 1 })
        await ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
          ctx.project._id,
          ctx.userId,
          'review'
        )
      })
    })

    describe('sets a collaborator to reviewer when track changes is not enabled for everyone', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.promises.getProject = sinon.stub().resolves({
          _id: new ObjectId(),
          owner_ref: ctx.addingUserId,
          name: 'Foo',
          track_changes: {
            [ctx.userId]: true,
          },
        })
      })
      it('should correctly update the project', async function (ctx) {
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
              $or: [
                { collaberator_refs: ctx.userId },
                { readOnly_refs: ctx.userId },
                { reviewer_refs: ctx.userId },
              ],
            },
            {
              $addToSet: { reviewer_refs: ctx.userId },
              $set: { [`track_changes.${ctx.userId}`]: true },
              $pull: {
                readOnly_refs: ctx.userId,
                collaberator_refs: ctx.userId,
                pendingEditor_refs: ctx.userId,
                pendingReviewer_refs: ctx.userId,
              },
            }
          )
          .chain('exec')
          .resolves({ matchedCount: 1 })
        await ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
          ctx.project._id,
          ctx.userId,
          'review'
        )
      })
    })

    it('sets a collaborator to read-only as a pendingEditor', async function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: ctx.project._id,
            $or: [
              { collaberator_refs: ctx.userId },
              { readOnly_refs: ctx.userId },
              { reviewer_refs: ctx.userId },
            ],
          },
          {
            $addToSet: {
              readOnly_refs: ctx.userId,
              pendingEditor_refs: ctx.userId,
            },
            $pull: {
              collaberator_refs: ctx.userId,
              reviewer_refs: ctx.userId,
              pendingReviewer_refs: ctx.userId,
            },
          }
        )
        .chain('exec')
        .resolves({ matchedCount: 1 })
      await ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        ctx.project._id,
        ctx.userId,
        'readOnly',
        { pendingEditor: true }
      )
    })

    it('sets a collaborator to read-only as a pendingReviewer', async function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: ctx.project._id,
            $or: [
              { collaberator_refs: ctx.userId },
              { readOnly_refs: ctx.userId },
              { reviewer_refs: ctx.userId },
            ],
          },
          {
            $addToSet: {
              readOnly_refs: ctx.userId,
              pendingReviewer_refs: ctx.userId,
            },
            $pull: {
              collaberator_refs: ctx.userId,
              reviewer_refs: ctx.userId,
              pendingEditor_refs: ctx.userId,
            },
          }
        )
        .chain('exec')
        .resolves({ matchedCount: 1 })
      await ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
        ctx.project._id,
        ctx.userId,
        'readOnly',
        { pendingReviewer: true }
      )
    })

    it('throws a NotFoundError if the project or collaborator does not exist', async function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .chain('exec')
        .resolves({ matchedCount: 0 })
      await expect(
        ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
          ctx.project._id,
          ctx.userId,
          'readAndWrite'
        )
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })
})
