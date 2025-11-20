import { expect, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Crypto from 'node:crypto'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteHandler.mjs'

describe('CollaboratorsInviteHandler', function () {
  beforeEach(async function (ctx) {
    ctx.ProjectInvite = class ProjectInvite {
      constructor(options) {
        if (options == null) {
          options = {}
        }
        this._id = new ObjectId()
        for (const k in options) {
          const v = options[k]
          this[k] = v
        }
      }
    }
    ctx.ProjectInvite.prototype.save = sinon.stub()
    ctx.ProjectInvite.findOne = sinon.stub()
    ctx.ProjectInvite.find = sinon.stub()
    ctx.ProjectInvite.deleteOne = sinon.stub()
    ctx.ProjectInvite.findOneAndDelete = sinon.stub()
    ctx.ProjectInvite.countDocuments = sinon.stub()

    ctx.Crypto = {
      randomBytes: sinon.stub().callsFake(Crypto.randomBytes),
    }
    ctx.settings = {}
    ctx.CollaboratorsEmailHandler = { promises: {} }
    ctx.CollaboratorsHandler = {
      promises: {
        addUserIdToProject: sinon.stub(),
      },
    }
    ctx.UserGetter = { promises: { getUser: sinon.stub() } }
    ctx.ProjectGetter = { promises: { getProject: sinon.stub().resolves() } }
    ctx.NotificationsBuilder = { promises: {} }
    ctx.tokenHmac = 'jkhajkefhaekjfhkfg'
    ctx.CollaboratorsInviteHelper = {
      generateToken: sinon.stub().returns(ctx.Crypto.randomBytes(24)),
      hashInviteToken: sinon.stub().returns(ctx.tokenHmac),
    }

    ctx.CollaboratorsInviteGetter = {
      promises: {
        getAllInvites: sinon.stub(),
      },
    }

    ctx.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves(),
      },
    }

    ctx.LimitationsManager = {
      promises: {
        canAcceptEditCollaboratorInvite: sinon.stub().resolves(),
      },
    }

    ctx.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
      addEntryInBackground: sinon.stub(),
    }
    ctx.logger = {
      debug: sinon.stub(),
      warn: sinon.stub(),
      err: sinon.stub(),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/models/ProjectInvite.mjs', () => ({
      ProjectInvite: ctx.ProjectInvite,
    }))

    vi.doMock('@overleaf/logger', () => ({
      default: ctx.logger,
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsEmailHandler.mjs',
      () => ({
        default: ctx.CollaboratorsEmailHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler.mjs',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter.mjs', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder.mjs',
      () => ({
        default: ctx.NotificationsBuilder,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteHelper.mjs',
      () => ({
        default: ctx.CollaboratorsInviteHelper,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteGetter',
      () => ({
        default: ctx.CollaboratorsInviteGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager.mjs',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.mjs',
      () => ({
        default: ctx.ProjectAuditLogHandler,
      })
    )

    vi.doMock('crypto', () => ({
      default: ctx.CryptogetAssignmentForUser,
    }))

    ctx.CollaboratorsInviteHandler = (await import(MODULE_PATH)).default

    ctx.projectId = new ObjectId()
    ctx.sendingUserId = new ObjectId()
    ctx.sendingUser = {
      _id: ctx.sendingUserId,
      name: 'Bob',
    }
    ctx.email = 'user@example.com'
    ctx.userId = new ObjectId()
    ctx.user = {
      _id: ctx.userId,
      email: 'someone@example.com',
    }
    ctx.inviteId = new ObjectId()
    ctx.token = 'hnhteaosuhtaeosuahs'
    ctx.privileges = 'readAndWrite'
    ctx.fakeInvite = {
      _id: ctx.inviteId,
      email: ctx.email,
      token: ctx.token,
      tokenHmac: ctx.tokenHmac,
      sendingUserId: ctx.sendingUserId,
      projectId: ctx.projectId,
      privileges: ctx.privileges,
      createdAt: new Date(),
    }
  })

  describe('inviteToProject', function () {
    beforeEach(function (ctx) {
      ctx.ProjectInvite.prototype.save.callsFake(async function () {
        Object.defineProperty(this, 'toObject', {
          value: function () {
            return this
          },
          writable: true,
          configurable: true,
          enumerable: false,
        })
        return this
      })
      ctx.CollaboratorsInviteHandler.promises._sendMessages = sinon
        .stub()
        .resolves()
      ctx.call = async () => {
        return await ctx.CollaboratorsInviteHandler.promises.inviteToProject(
          ctx.projectId,
          ctx.sendingUser,
          ctx.email,
          ctx.privileges
        )
      }
    })

    describe('when all goes well', function () {
      it('should produce the invite object', async function (ctx) {
        const invite = await ctx.call()
        expect(invite).to.not.equal(null)
        expect(invite).to.not.equal(undefined)
        expect(invite).to.be.instanceof(Object)
        expect(invite).to.have.all.keys(['_id', 'email', 'privileges'])
      })

      it('should have generated a random token', async function (ctx) {
        await ctx.call()
        ctx.Crypto.randomBytes.callCount.should.equal(1)
      })

      it('should have generated a HMAC token', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHelper.hashInviteToken.callCount.should.equal(1)
      })

      it('should have called ProjectInvite.save', async function (ctx) {
        await ctx.call()
        ctx.ProjectInvite.prototype.save.callCount.should.equal(1)
      })

      it('should have called _sendMessages', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises._sendMessages.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteHandler.promises._sendMessages
          .calledWith(ctx.projectId, ctx.sendingUser)
          .should.equal(true)
      })
    })

    describe('when saving model produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectInvite.prototype.save.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })
    })
  })

  describe('_sendMessages', function () {
    beforeEach(function (ctx) {
      ctx.CollaboratorsEmailHandler.promises.notifyUserOfProjectInvite = sinon
        .stub()
        .resolves()
      ctx.CollaboratorsInviteHandler.promises._trySendInviteNotification = sinon
        .stub()
        .resolves()
      ctx.call = async () => {
        await ctx.CollaboratorsInviteHandler.promises._sendMessages(
          ctx.projectId,
          ctx.sendingUser,
          ctx.fakeInvite
        )
      }
    })

    describe('when all goes well', function () {
      it('should call CollaboratorsEmailHandler.notifyUserOfProjectInvite', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsEmailHandler.promises.notifyUserOfProjectInvite.callCount.should.equal(
          1
        )
        ctx.CollaboratorsEmailHandler.promises.notifyUserOfProjectInvite
          .calledWith(ctx.projectId, ctx.fakeInvite.email, ctx.fakeInvite)
          .should.equal(true)
      })

      it('should call _trySendInviteNotification', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises._trySendInviteNotification.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteHandler.promises._trySendInviteNotification
          .calledWith(ctx.projectId, ctx.sendingUser, ctx.fakeInvite)
          .should.equal(true)
      })
    })

    describe('when CollaboratorsEmailHandler.notifyUserOfProjectInvite produces an error', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsEmailHandler.promises.notifyUserOfProjectInvite = sinon
          .stub()
          .rejects(new Error('woops'))
      })

      it('should not produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.fulfilled
        expect(ctx.logger.err).to.be.calledOnce
      })
    })

    describe('when _trySendInviteNotification produces an error', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsInviteHandler.promises._trySendInviteNotification =
          sinon.stub().rejects(new Error('woops'))
      })

      it('should not produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.fulfilled
        expect(ctx.logger.err).to.be.calledOnce
      })
    })
  })
  describe('revokeInviteForUser', function () {
    beforeEach(function (ctx) {
      ctx.targetInvite = {
        _id: new ObjectId(),
        email: 'fake2@example.org',
        two: 2,
      }
      ctx.fakeInvites = [
        { _id: new ObjectId(), email: 'fake1@example.org', one: 1 },
        ctx.targetInvite,
      ]
      ctx.fakeInvitesWithoutUser = [
        { _id: new ObjectId(), email: 'fake1@example.org', one: 1 },
        { _id: new ObjectId(), email: 'fake3@example.org', two: 2 },
      ]
      ctx.targetEmail = [{ email: 'fake2@example.org' }]

      ctx.CollaboratorsInviteGetter.promises.getAllInvites.resolves(
        ctx.fakeInvites
      )
      ctx.CollaboratorsInviteHandler.promises.revokeInvite = sinon
        .stub()
        .resolves(ctx.targetInvite)

      ctx.call = async () => {
        return await ctx.CollaboratorsInviteHandler.promises.revokeInviteForUser(
          ctx.projectId,
          ctx.targetEmail
        )
      }
    })

    describe('for a valid user', function () {
      it('should have called CollaboratorsInviteGetter.getAllInvites', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteGetter.promises.getAllInvites.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteGetter.promises.getAllInvites
          .calledWith(ctx.projectId)
          .should.equal(true)
      })

      it('should have called revokeInvite', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          1
        )

        ctx.CollaboratorsInviteHandler.promises.revokeInvite
          .calledWith(ctx.projectId, ctx.targetInvite._id)
          .should.equal(true)
      })
    })

    describe('for a user without an invite in the project', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getAllInvites.resolves(
          ctx.fakeInvitesWithoutUser
        )
      })
      it('should not have called CollaboratorsInviteHandler.revokeInvite', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          0
        )
      })
    })
  })

  describe('revokeInvite', function () {
    beforeEach(function (ctx) {
      ctx.ProjectInvite.findOneAndDelete.returns({
        exec: sinon.stub().resolves(ctx.fakeInvite),
      })
      ctx.CollaboratorsInviteHandler.promises._tryCancelInviteNotification =
        sinon.stub().resolves()
      ctx.call = async () => {
        return await ctx.CollaboratorsInviteHandler.promises.revokeInvite(
          ctx.projectId,
          ctx.inviteId
        )
      }
    })

    describe('when all goes well', function () {
      it('should call ProjectInvite.findOneAndDelete', async function (ctx) {
        await ctx.call()
        ctx.ProjectInvite.findOneAndDelete.should.have.been.calledOnce
        ctx.ProjectInvite.findOneAndDelete.should.have.been.calledWith({
          projectId: ctx.projectId,
          _id: ctx.inviteId,
        })
      })

      it('should call _tryCancelInviteNotification', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises._tryCancelInviteNotification.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteHandler.promises._tryCancelInviteNotification
          .calledWith(ctx.inviteId)
          .should.equal(true)
      })

      it('should return the deleted invite', async function (ctx) {
        const invite = await ctx.call()
        expect(invite).to.deep.equal(ctx.fakeInvite)
      })
    })

    describe('when remove produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectInvite.findOneAndDelete.returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })
    })
  })

  describe('generateNewInvite', function () {
    beforeEach(function (ctx) {
      ctx.fakeInviteToProjectObject = {
        _id: new ObjectId(),
        email: ctx.email,
        privileges: ctx.privileges,
      }
      ctx.CollaboratorsInviteHandler.promises.revokeInvite = sinon
        .stub()
        .resolves(ctx.fakeInvite)
      ctx.CollaboratorsInviteHandler.promises.inviteToProject = sinon
        .stub()
        .resolves(ctx.fakeInviteToProjectObject)
      ctx.call = async () => {
        return await ctx.CollaboratorsInviteHandler.promises.generateNewInvite(
          ctx.projectId,
          ctx.sendingUser,
          ctx.inviteId
        )
      }
    })

    describe('when all goes well', function () {
      it('should call revokeInvite', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteHandler.promises.revokeInvite
          .calledWith(ctx.projectId, ctx.inviteId)
          .should.equal(true)
      })

      it('should have called inviteToProject', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteHandler.promises.inviteToProject
          .calledWith(
            ctx.projectId,
            ctx.sendingUser,
            ctx.fakeInvite.email,
            ctx.fakeInvite.privileges
          )
          .should.equal(true)
      })

      it('should return the invite', async function (ctx) {
        const invite = await ctx.call()
        expect(invite).to.deep.equal(ctx.fakeInviteToProjectObject)
      })
    })

    describe('when revokeInvite produces an error', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.revokeInvite = sinon
          .stub()
          .rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })

      it('should not have called inviteToProject', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when findOne does not find an invite', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.revokeInvite = sinon
          .stub()
          .resolves(null)
      })

      it('should not have called inviteToProject', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })
  })

  describe('acceptInvite', function () {
    beforeEach(function (ctx) {
      ctx.fakeProject = {
        _id: ctx.projectId,
        owner_ref: ctx.sendingUserId,
      }
      ctx.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves(ctx.fakeProject)
      ctx.CollaboratorsHandler.promises.addUserIdToProject.resolves()
      ctx.CollaboratorsInviteHandler.promises._tryCancelInviteNotification =
        sinon.stub().resolves()
      ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
        true
      )
      ctx.ProjectInvite.deleteOne.returns({ exec: sinon.stub().resolves() })
      ctx.call = async () => {
        await ctx.CollaboratorsInviteHandler.promises.acceptInvite(
          ctx.fakeInvite,
          ctx.projectId,
          ctx.user
        )
      }
    })

    describe('when all goes well', function () {
      it('should add readAndWrite invitees to the project as normal', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsHandler.promises.addUserIdToProject.should.have.been.calledWith(
          ctx.projectId,
          ctx.sendingUserId,
          ctx.userId,
          ctx.fakeInvite.privileges
        )
      })

      it('should have called ProjectInvite.deleteOne', async function (ctx) {
        await ctx.call()
        ctx.ProjectInvite.deleteOne.callCount.should.equal(1)
        ctx.ProjectInvite.deleteOne
          .calledWith({ _id: ctx.inviteId })
          .should.equal(true)
      })
    })

    describe('when the invite is for readOnly access', function () {
      beforeEach(function (ctx) {
        ctx.fakeInvite.privileges = 'readOnly'
      })

      it('should have called CollaboratorsHandler.addUserIdToProject', async function (ctx) {
        await ctx.call()
        ctx.CollaboratorsHandler.promises.addUserIdToProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsHandler.promises.addUserIdToProject
          .calledWith(
            ctx.projectId,
            ctx.sendingUserId,
            ctx.userId,
            ctx.fakeInvite.privileges
          )
          .should.equal(true)
      })
    })

    describe('when the project has no more edit collaborator slots', function () {
      beforeEach(function (ctx) {
        ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          false
        )
      })

      it('should add readAndWrite invitees to the project as readOnly (pendingEditor) users', async function (ctx) {
        await ctx.call()
        ctx.ProjectAuditLogHandler.promises.addEntry.should.have.been.calledWith(
          ctx.projectId,
          'editor-moved-to-pending',
          null,
          null,
          { userId: ctx.userId.toString(), role: 'editor' }
        )
        ctx.CollaboratorsHandler.promises.addUserIdToProject.should.have.been.calledWith(
          ctx.projectId,
          ctx.sendingUserId,
          ctx.userId,
          'readOnly',
          { pendingEditor: true }
        )
      })
    })

    describe('when addUserIdToProject produces an error', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsHandler.promises.addUserIdToProject.callsArgWith(
          4,
          new Error('woops')
        )
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })

      it('should have called CollaboratorsHandler.addUserIdToProject', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.CollaboratorsHandler.promises.addUserIdToProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsHandler.promises.addUserIdToProject
          .calledWith(
            ctx.projectId,
            ctx.sendingUserId,
            ctx.userId,
            ctx.fakeInvite.privileges
          )
          .should.equal(true)
      })

      it('should not have called ProjectInvite.deleteOne', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.ProjectInvite.deleteOne.callCount.should.equal(0)
      })
    })

    describe('when ProjectInvite.deleteOne produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectInvite.deleteOne.returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })

      it('should have called CollaboratorsHandler.addUserIdToProject', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.CollaboratorsHandler.promises.addUserIdToProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsHandler.promises.addUserIdToProject.should.have.been.calledWith(
          ctx.projectId,
          ctx.sendingUserId,
          ctx.userId,
          ctx.fakeInvite.privileges
        )
      })

      it('should have called ProjectInvite.deleteOne', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.ProjectInvite.deleteOne.callCount.should.equal(1)
      })
    })
  })

  describe('_tryCancelInviteNotification', function () {
    beforeEach(function (ctx) {
      ctx.inviteId = new ObjectId()
      ctx.currentUser = { _id: new ObjectId() }
      ctx.notification = { read: sinon.stub().resolves() }
      ctx.NotificationsBuilder.promises.projectInvite = sinon
        .stub()
        .returns(ctx.notification)
      ctx.call = async () => {
        await ctx.CollaboratorsInviteHandler.promises._tryCancelInviteNotification(
          ctx.inviteId
        )
      }
    })

    it('should call notification.read', async function (ctx) {
      await ctx.call()
      ctx.notification.read.callCount.should.equal(1)
    })

    describe('when notification.read produces an error', function () {
      beforeEach(function (ctx) {
        ctx.notification = {
          read: sinon.stub().rejects(new Error('woops')),
        }
        ctx.NotificationsBuilder.promises.projectInvite = sinon
          .stub()
          .returns(ctx.notification)
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
      })
    })
  })

  describe('_trySendInviteNotification', function () {
    beforeEach(function (ctx) {
      ctx.invite = {
        _id: new ObjectId(),
        token: 'some_token',
        sendingUserId: new ObjectId(),
        projectId: ctx.project_id,
        targetEmail: 'user@example.com',
        createdAt: new Date(),
      }
      ctx.sendingUser = {
        _id: new ObjectId(),
        first_name: 'jim',
      }
      ctx.existingUser = { _id: new ObjectId() }
      ctx.UserGetter.promises.getUserByAnyEmail = sinon
        .stub()
        .resolves(ctx.existingUser)
      ctx.fakeProject = {
        _id: ctx.project_id,
        name: 'some project',
      }
      ctx.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves(ctx.fakeProject)
      ctx.notification = { create: sinon.stub().resolves() }
      ctx.NotificationsBuilder.promises.projectInvite = sinon
        .stub()
        .returns(ctx.notification)
      ctx.call = async () => {
        await ctx.CollaboratorsInviteHandler.promises._trySendInviteNotification(
          ctx.project_id,
          ctx.sendingUser,
          ctx.invite
        )
      }
    })

    describe('when the user exists', function () {
      beforeEach(function () {})

      it('should call getUser', async function (ctx) {
        await ctx.call()
        ctx.UserGetter.promises.getUserByAnyEmail.callCount.should.equal(1)
        ctx.UserGetter.promises.getUserByAnyEmail
          .calledWith(ctx.invite.email)
          .should.equal(true)
      })

      it('should call getProject', async function (ctx) {
        await ctx.call()
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(1)
        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should call NotificationsBuilder.projectInvite.create', async function (ctx) {
        await ctx.call()
        ctx.NotificationsBuilder.promises.projectInvite.callCount.should.equal(
          1
        )
        ctx.notification.create.callCount.should.equal(1)
      })

      describe('when getProject produces an error', function () {
        beforeEach(function (ctx) {
          ctx.ProjectGetter.promises.getProject.callsArgWith(
            2,
            new Error('woops')
          )
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejectedWith(Error)
        })

        it('should not call NotificationsBuilder.projectInvite.create', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
          ctx.NotificationsBuilder.promises.projectInvite.callCount.should.equal(
            0
          )
          ctx.notification.create.callCount.should.equal(0)
        })
      })

      describe('when projectInvite.create produces an error', function () {
        beforeEach(function (ctx) {
          ctx.notification.create.callsArgWith(0, new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejectedWith(Error)
        })
      })
    })

    describe('when the user does not exist', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUserByAnyEmail = sinon.stub().resolves(null)
      })

      it('should call getUser', async function (ctx) {
        await ctx.call()
        ctx.UserGetter.promises.getUserByAnyEmail.callCount.should.equal(1)
        ctx.UserGetter.promises.getUserByAnyEmail
          .calledWith(ctx.invite.email)
          .should.equal(true)
      })

      it('should not call getProject', async function (ctx) {
        await ctx.call()
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })

      it('should not call NotificationsBuilder.projectInvite.create', async function (ctx) {
        await ctx.call()
        ctx.NotificationsBuilder.promises.projectInvite.callCount.should.equal(
          0
        )
        ctx.notification.create.callCount.should.equal(0)
      })
    })

    describe('when the getUser produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUserByAnyEmail = sinon
          .stub()
          .rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })

      it('should call getUser', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.UserGetter.promises.getUserByAnyEmail.callCount.should.equal(1)
        ctx.UserGetter.promises.getUserByAnyEmail
          .calledWith(ctx.invite.email)
          .should.equal(true)
      })

      it('should not call getProject', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })

      it('should not call NotificationsBuilder.projectInvite.create', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.NotificationsBuilder.promises.projectInvite.callCount.should.equal(
          0
        )
        ctx.notification.create.callCount.should.equal(0)
      })
    })
  })
})
