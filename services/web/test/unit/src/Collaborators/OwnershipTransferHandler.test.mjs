import { vi, expect } from 'vitest'
import sinon from 'sinon'
import PrivilegeLevels from '../../../../app/src/Features/Authorization/PrivilegeLevels.mjs'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/OwnershipTransferHandler.mjs'

describe('OwnershipTransferHandler', function () {
  beforeEach(async function (ctx) {
    ctx.user = { _id: new ObjectId(), email: 'owner@example.com' }
    ctx.collaborator = {
      _id: new ObjectId(),
      email: 'collaborator@example.com',
    }
    ctx.readOnlyCollaborator = {
      _id: new ObjectId(),
      email: 'readonly@example.com',
    }
    ctx.reviewer = {
      _id: new ObjectId(),
      email: 'reviewer@example.com',
    }
    ctx.project = {
      _id: new ObjectId(),
      name: 'project',
      owner_ref: ctx.user._id,
      collaberator_refs: [ctx.collaborator._id],
      readOnly_refs: [ctx.readOnlyCollaborator._id],
      reviewer_refs: [ctx.reviewer._id],
    }
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }
    ctx.ProjectModel = {
      find: sinon.stub().resolves([]),
      updateOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(),
      },
    }
    ctx.TpdsUpdateSender = {
      promises: {
        moveEntity: sinon.stub().resolves(),
      },
    }
    ctx.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }
    ctx.CollaboratorsHandler = {
      promises: {
        removeUserFromProject: sinon.stub().resolves(),
        addUserIdToProject: sinon.stub().resolves(),
      },
    }
    ctx.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    ctx.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }
    ctx.TagsHandler = {
      promises: {
        createTag: sinon.stub().resolves(),
        addProjectsToTag: sinon.stub().resolves(),
      },
    }
    ctx.LimitationsManager = {
      promises: {
        canAddXEditCollaborators: sinon.stub().resolves(true),
      },
    }

    vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
      vi.importActual('../../../../app/src/Features/Errors/Errors.js')
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter.mjs', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/models/Project.mjs', () => ({
      Project: ctx.ProjectModel,
    }))

    vi.doMock('../../../../app/src/Features/Tags/TagsHandler.mjs', () => ({
      default: ctx.TagsHandler,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher.mjs',
      () => ({
        default: ctx.TpdsProjectFlusher,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.mjs',
      () => ({
        default: ctx.ProjectAuditLogHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Email/EmailHandler.mjs', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler.mjs',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: {
          recordEventForUserInBackground: (ctx.recordEventForUserInBackground =
            sinon.stub()),
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager.mjs',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    ctx.handler = (await import(MODULE_PATH)).default
  })

  describe('transferOwnership', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.promises.getUser.withArgs(ctx.user._id).resolves(ctx.user)
      ctx.UserGetter.promises.getUser
        .withArgs(ctx.collaborator._id)
        .resolves(ctx.collaborator)
      ctx.UserGetter.promises.getUser
        .withArgs(ctx.readOnlyCollaborator._id)
        .resolves(ctx.readOnlyCollaborator)
      ctx.UserGetter.promises.getUser
        .withArgs(ctx.reviewer._id)
        .resolves(ctx.reviewer)
    })

    it("should return a not found error if the project can't be found", async function (ctx) {
      ctx.ProjectGetter.promises.getProject.resolves(null)
      await expect(
        ctx.handler.promises.transferOwnership('abc', ctx.collaborator._id)
      ).to.be.rejectedWith(Errors.ProjectNotFoundError)
    })

    it("should return a not found error if the user can't be found", async function (ctx) {
      ctx.UserGetter.promises.getUser
        .withArgs(ctx.collaborator._id)
        .resolves(null)
      await expect(
        ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.collaborator._id
        )
      ).to.be.rejectedWith(Errors.UserNotFoundError)
    })

    it('should return an error if user cannot be removed as collaborator ', async function (ctx) {
      ctx.CollaboratorsHandler.promises.removeUserFromProject.rejects(
        new Error('user-cannot-be-removed')
      )
      await expect(
        ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.collaborator._id
        )
      ).to.be.rejected
    })

    it('should transfer ownership of the project', async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id
      )
      expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: ctx.project._id },
        sinon.match({ $set: { owner_ref: ctx.collaborator._id } })
      )
    })

    it('should check collaborator limits after ownership transfer', async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id
      )

      expect(ctx.ProjectModel.updateOne).to.have.been.calledBefore(
        ctx.LimitationsManager.promises.canAddXEditCollaborators
      )

      expect(
        ctx.LimitationsManager.promises.canAddXEditCollaborators
      ).to.have.been.calledBefore(
        ctx.CollaboratorsHandler.promises.addUserIdToProject
      )
    })

    describe('when there are edit collaborator slots available', function () {
      beforeEach(function (ctx) {
        ctx.LimitationsManager.promises.canAddXEditCollaborators.resolves(true)
      })

      it('should give old owner read/write permissions when transferring to a read-only collaborator', async function (ctx) {
        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.readOnlyCollaborator._id
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.readOnlyCollaborator._id,
          ctx.user._id,
          PrivilegeLevels.READ_AND_WRITE,
          undefined
        )
        expect(
          ctx.LimitationsManager.promises.canAddXEditCollaborators
        ).to.have.been.calledWith(ctx.project._id, 1)
      })

      it('should give old owner read/write permissions when transferring to an editor', async function (ctx) {
        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.collaborator._id
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.collaborator._id,
          ctx.user._id,
          PrivilegeLevels.READ_AND_WRITE,
          undefined
        )
        expect(
          ctx.LimitationsManager.promises.canAddXEditCollaborators
        ).to.have.been.calledWith(ctx.project._id, 1)
      })

      it('should give old owner read/write permissions when transferring to a reviewer', async function (ctx) {
        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.reviewer._id
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.reviewer._id,
          ctx.user._id,
          PrivilegeLevels.READ_AND_WRITE,
          undefined
        )
        expect(
          ctx.LimitationsManager.promises.canAddXEditCollaborators
        ).to.have.been.calledWith(ctx.project._id, 1)
      })

      it('should give old owner read/write permissions when transferring to a non-collaborator', async function (ctx) {
        ctx.project.collaberator_refs = []
        ctx.project.readOnly_refs = []
        ctx.project.reviewer_refs = []
        const newOwner = {
          _id: new ObjectId(),
          email: 'admin@example.com',
        }
        ctx.UserGetter.promises.getUser
          .withArgs(newOwner._id)
          .resolves(newOwner)

        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          newOwner._id,
          { allowTransferToNonCollaborators: true }
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          newOwner._id,
          ctx.user._id,
          PrivilegeLevels.READ_AND_WRITE,
          undefined
        )
        expect(
          ctx.LimitationsManager.promises.canAddXEditCollaborators
        ).to.have.been.calledWith(ctx.project._id, 1)
      })
    })

    describe('when there are no edit collaborator slots available', function () {
      beforeEach(function (ctx) {
        ctx.LimitationsManager.promises.canAddXEditCollaborators.resolves(false)
      })

      it('should give old owner read-only with pending editor flag when transferring to an editor', async function (ctx) {
        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.collaborator._id
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.collaborator._id,
          ctx.user._id,
          PrivilegeLevels.READ_ONLY,
          { pendingEditor: true }
        )
      })

      it('should give old owner read-only with pending editor flag when transferring to a reviewer', async function (ctx) {
        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.reviewer._id
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.reviewer._id,
          ctx.user._id,
          PrivilegeLevels.READ_ONLY,
          { pendingEditor: true }
        )
      })

      it('should give old owner read-only with pending editor flag when transferring to a read-only collaborator', async function (ctx) {
        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.readOnlyCollaborator._id
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.readOnlyCollaborator._id,
          ctx.user._id,
          PrivilegeLevels.READ_ONLY,
          { pendingEditor: true }
        )
      })

      it('should give old owner read-only with pending editor flag when transferring to a non-collaborator', async function (ctx) {
        ctx.project.collaberator_refs = []
        ctx.project.readOnly_refs = []
        ctx.project.reviewer_refs = []
        const newOwner = {
          _id: new ObjectId(),
          email: 'newowner@example.com',
        }
        ctx.UserGetter.promises.getUser
          .withArgs(newOwner._id)
          .resolves(newOwner)

        await ctx.handler.promises.transferOwnership(
          ctx.project._id,
          newOwner._id,
          { allowTransferToNonCollaborators: true }
        )
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          newOwner._id,
          ctx.user._id,
          PrivilegeLevels.READ_ONLY,
          { pendingEditor: true }
        )
      })
    })

    it('should do nothing if transferring back to the owner', async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.user._id
      )
      expect(ctx.ProjectModel.updateOne).not.to.have.been.called
    })

    it("should remove the user from the project's collaborators", async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id
      )
      expect(
        ctx.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(ctx.project._id, ctx.collaborator._id)
    })

    it('should transfer ownership of the project to a reviewer', async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.reviewer._id
      )
      expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: ctx.project._id },
        sinon.match({ $set: { owner_ref: ctx.reviewer._id } })
      )
    })

    it('should flush the project to tpds', async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id
      )
      expect(
        ctx.TpdsProjectFlusher.promises.flushProjectToTpds
      ).to.have.been.calledWith(ctx.project._id)
    })

    it('should send an email notification', async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id
      )
      expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'ownershipTransferConfirmationPreviousOwner',
        {
          to: ctx.user.email,
          project: ctx.project,
          newOwner: ctx.collaborator,
        }
      )
      expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'ownershipTransferConfirmationNewOwner',
        {
          to: ctx.collaborator.email,
          project: ctx.project,
          previousOwner: ctx.user,
        }
      )
    })

    it('should not send an email notification with the skipEmails option', async function (ctx) {
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id,
        { skipEmails: true }
      )
      expect(ctx.EmailHandler.promises.sendEmail).not.to.have.been.called
    })

    it('should track the change in BigQuery', async function (ctx) {
      const sessionUserId = new ObjectId()
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id,
        { sessionUserId }
      )
      expect(ctx.recordEventForUserInBackground).to.have.been.calledWith(
        ctx.user._id,
        'project-ownership-transfer',
        {
          projectId: ctx.project._id,
          newOwnerId: ctx.collaborator._id,
        }
      )
    })

    it('should write an entry in the audit log', async function (ctx) {
      const sessionUserId = new ObjectId()
      const ipAddress = '1.2.3.4'
      await ctx.handler.promises.transferOwnership(
        ctx.project._id,
        ctx.collaborator._id,
        { sessionUserId, ipAddress }
      )
      expect(
        ctx.ProjectAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        ctx.project._id,
        'transfer-ownership',
        sessionUserId,
        ipAddress,
        {
          previousOwnerId: ctx.user._id,
          newOwnerId: ctx.collaborator._id,
        }
      )
    })

    it('should decline to transfer ownership to a non-collaborator', async function (ctx) {
      ctx.project.collaberator_refs = []
      ctx.project.readOnly_refs = []
      await expect(
        ctx.handler.promises.transferOwnership(
          ctx.project._id,
          ctx.collaborator._id
        )
      ).to.be.rejectedWith(Errors.UserNotCollaboratorError)
    })
  })

  describe('transferAllProjectsToUser', function () {
    const fromUserEmail = 'user.one@example.com'
    const ipAddress = '1.2.3.4'
    let fromUserId, toUserId
    beforeEach(function () {
      fromUserId = new ObjectId().toString()
      toUserId = new ObjectId().toString()
    })

    describe('with missing user', function () {
      it('should throw an error', async function (ctx) {
        ctx.UserGetter.promises.getUser.withArgs(fromUserId).resolves(null)
        ctx.UserGetter.promises.getUser
          .withArgs(toUserId)
          .resolves({ _id: new ObjectId(toUserId) })
        await expect(
          ctx.handler.promises.transferAllProjectsToUser({
            toUserId,
            fromUserId,
            ipAddress,
          })
        ).to.be.rejectedWith(/missing source user/)

        ctx.UserGetter.promises.getUser
          .withArgs(fromUserId)
          .resolves({ _id: new ObjectId(fromUserId), email: fromUserEmail })
        ctx.UserGetter.promises.getUser.withArgs(toUserId).resolves(null)
        await expect(
          ctx.handler.promises.transferAllProjectsToUser({
            fromUserId,
            toUserId,
            ipAddress,
          })
        ).to.be.rejectedWith(/missing destination user/)
      })
    })

    describe('with the same id', function () {
      it('should throw an error', async function (ctx) {
        ctx.UserGetter.promises.getUser
          .withArgs(fromUserId)
          .resolves({ _id: new ObjectId(fromUserId), email: fromUserEmail })
        await expect(
          ctx.handler.promises.transferAllProjectsToUser({
            fromUserId,
            toUserId: fromUserId,
            ipAddress,
          })
        ).to.be.rejectedWith(/rejecting transfer between identical users/)
      })
    })

    describe('happy path', function () {
      let tag, fromUserEmail, projects

      beforeEach(function (ctx) {
        tag = {
          _id: new ObjectId(),
          name: 'some-tag-name',
        }
        projects = [
          { _id: 'project-1' },
          { _id: 'project-2' },
          { _id: 'project-3' },
        ]

        ctx.UserGetter.promises.getUser.withArgs(fromUserId).resolves({
          _id: new ObjectId(fromUserId),
          email: fromUserEmail,
        })
        ctx.UserGetter.promises.getUser.withArgs(toUserId).resolves({
          _id: new ObjectId(toUserId),
        })
        ctx.ProjectModel.find.resolves(projects)
        ctx.TagsHandler.promises.createTag.resolves({
          _id: tag._id,
          name: 'some-tag-name',
        })
        ctx.TagsHandler.promises.addProjectsToTag.resolves()
      })

      it('creates a tag', async function (ctx) {
        await ctx.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(ctx.TagsHandler.promises.createTag).to.have.been.calledWith(
          toUserId,
          `transferred-from-${fromUserEmail}`,
          '#434AF0',
          { truncate: true }
        )
      })

      it('returns a projectCount, and tag name', async function (ctx) {
        const result = await ctx.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(result.projectCount).to.equal(projects.length)
        expect(result.newTagName).to.equal('some-tag-name')
      })

      it('gets the user records', async function (ctx) {
        await ctx.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(ctx.UserGetter.promises.getUser).to.have.been.calledWith(
          fromUserId
        )
        expect(ctx.UserGetter.promises.getUser).to.have.been.calledWith(
          toUserId
        )
      })

      it('gets the list of affected projects', async function (ctx) {
        await ctx.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(ctx.ProjectModel.find).to.have.been.calledWith({
          owner_ref: fromUserId,
        })
      })

      it('transfers all of the projects', async function (ctx) {
        await ctx.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })

        expect(ctx.ProjectModel.updateOne.callCount).to.equal(3)
        expect(ctx.TagsHandler.promises.addProjectsToTag.callCount).to.equal(1)

        for (const project of projects) {
          expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
            { _id: project._id },
            sinon.match({ $set: { owner_ref: toUserId } })
          )
        }
        expect(
          ctx.TagsHandler.promises.addProjectsToTag
        ).to.have.been.calledWith(
          toUserId,
          tag._id,
          projects.map(p => p._id)
        )
      })
    })
  })
})
