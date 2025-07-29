const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const PrivilegeLevels = require('../../../../app/src/Features/Authorization/PrivilegeLevels')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/OwnershipTransferHandler'

describe('OwnershipTransferHandler', function () {
  beforeEach(function () {
    this.user = { _id: new ObjectId(), email: 'owner@example.com' }
    this.collaborator = {
      _id: new ObjectId(),
      email: 'collaborator@example.com',
    }
    this.readOnlyCollaborator = {
      _id: new ObjectId(),
      email: 'readonly@example.com',
    }
    this.reviewer = {
      _id: new ObjectId(),
      email: 'reviewer@example.com',
    }
    this.project = {
      _id: new ObjectId(),
      name: 'project',
      owner_ref: this.user._id,
      collaberator_refs: [this.collaborator._id],
      readOnly_refs: [this.readOnlyCollaborator._id],
      reviewer_refs: [this.reviewer._id],
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }
    this.ProjectModel = {
      find: sinon.stub().resolves([]),
      updateOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(),
      },
    }
    this.TpdsUpdateSender = {
      promises: {
        moveEntity: sinon.stub().resolves(),
      },
    }
    this.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }
    this.CollaboratorsHandler = {
      promises: {
        removeUserFromProject: sinon.stub().resolves(),
        addUserIdToProject: sinon.stub().resolves(),
      },
    }
    this.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    this.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }
    this.TagsHandler = {
      promises: {
        createTag: sinon.stub().resolves(),
        addProjectsToTag: sinon.stub().resolves(),
      },
    }
    this.handler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../Project/ProjectGetter': this.ProjectGetter,
        '../../models/Project': {
          Project: this.ProjectModel,
        },
        '../Tags/TagsHandler': this.TagsHandler,
        '../User/UserGetter': this.UserGetter,
        '../ThirdPartyDataStore/TpdsProjectFlusher': this.TpdsProjectFlusher,
        '../Project/ProjectAuditLogHandler': this.ProjectAuditLogHandler,
        '../Email/EmailHandler': this.EmailHandler,
        './CollaboratorsHandler': this.CollaboratorsHandler,
        '../Analytics/AnalyticsManager': {
          recordEventForUserInBackground: (this.recordEventForUserInBackground =
            sinon.stub()),
        },
      },
    })
  })

  describe('transferOwnership', function () {
    beforeEach(function () {
      this.UserGetter.promises.getUser
        .withArgs(this.user._id)
        .resolves(this.user)
      this.UserGetter.promises.getUser
        .withArgs(this.collaborator._id)
        .resolves(this.collaborator)
      this.UserGetter.promises.getUser
        .withArgs(this.readOnlyCollaborator._id)
        .resolves(this.readOnlyCollaborator)
      this.UserGetter.promises.getUser
        .withArgs(this.reviewer._id)
        .resolves(this.reviewer)
    })

    it("should return a not found error if the project can't be found", async function () {
      this.ProjectGetter.promises.getProject.resolves(null)
      await expect(
        this.handler.promises.transferOwnership('abc', this.collaborator._id)
      ).to.be.rejectedWith(Errors.ProjectNotFoundError)
    })

    it("should return a not found error if the user can't be found", async function () {
      this.UserGetter.promises.getUser
        .withArgs(this.collaborator._id)
        .resolves(null)
      await expect(
        this.handler.promises.transferOwnership(
          this.project._id,
          this.collaborator._id
        )
      ).to.be.rejectedWith(Errors.UserNotFoundError)
    })

    it('should return an error if user cannot be removed as collaborator ', async function () {
      this.CollaboratorsHandler.promises.removeUserFromProject.rejects(
        new Error('user-cannot-be-removed')
      )
      await expect(
        this.handler.promises.transferOwnership(
          this.project._id,
          this.collaborator._id
        )
      ).to.be.rejected
    })

    it('should transfer ownership of the project', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(this.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: this.project._id },
        sinon.match({ $set: { owner_ref: this.collaborator._id } })
      )
    })

    it('should transfer ownership of the project to a read-only collaborator', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.readOnlyCollaborator._id
      )
      expect(this.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: this.project._id },
        sinon.match({ $set: { owner_ref: this.readOnlyCollaborator._id } })
      )
    })

    it('gives old owner read-only permissions if new owner was previously a viewer', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.readOnlyCollaborator._id
      )
      expect(
        this.CollaboratorsHandler.promises.addUserIdToProject
      ).to.have.been.calledWith(
        this.project._id,
        this.readOnlyCollaborator._id,
        this.user._id,
        PrivilegeLevels.READ_ONLY
      )
    })

    it('should do nothing if transferring back to the owner', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.user._id
      )
      expect(this.ProjectModel.updateOne).not.to.have.been.called
    })

    it("should remove the user from the project's collaborators", async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(
        this.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(this.project._id, this.collaborator._id)
    })

    it('should add the former project owner as a read/write collaborator', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(
        this.CollaboratorsHandler.promises.addUserIdToProject
      ).to.have.been.calledWith(
        this.project._id,
        this.collaborator._id,
        this.user._id,
        PrivilegeLevels.READ_AND_WRITE
      )
    })

    it('should transfer ownership of the project to a reviewer', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.reviewer._id
      )
      expect(this.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: this.project._id },
        sinon.match({ $set: { owner_ref: this.reviewer._id } })
      )
    })

    it('gives old owner reviewer permissions if new owner was previously a reviewer', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.reviewer._id
      )
      expect(
        this.CollaboratorsHandler.promises.addUserIdToProject
      ).to.have.been.calledWith(
        this.project._id,
        this.reviewer._id,
        this.user._id,
        PrivilegeLevels.REVIEW
      )
    })

    it('should flush the project to tpds', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(
        this.TpdsProjectFlusher.promises.flushProjectToTpds
      ).to.have.been.calledWith(this.project._id)
    })

    it('should send an email notification', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'ownershipTransferConfirmationPreviousOwner',
        {
          to: this.user.email,
          project: this.project,
          newOwner: this.collaborator,
        }
      )
      expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'ownershipTransferConfirmationNewOwner',
        {
          to: this.collaborator.email,
          project: this.project,
          previousOwner: this.user,
        }
      )
    })

    it('should not send an email notification with the skipEmails option', async function () {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id,
        { skipEmails: true }
      )
      expect(this.EmailHandler.promises.sendEmail).not.to.have.been.called
    })

    it('should track the change in BigQuery', async function () {
      const sessionUserId = new ObjectId()
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id,
        { sessionUserId }
      )
      expect(this.recordEventForUserInBackground).to.have.been.calledWith(
        this.user._id,
        'project-ownership-transfer',
        {
          projectId: this.project._id,
          newOwnerId: this.collaborator._id,
        }
      )
    })

    it('should write an entry in the audit log', async function () {
      const sessionUserId = new ObjectId()
      const ipAddress = '1.2.3.4'
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id,
        { sessionUserId, ipAddress }
      )
      expect(
        this.ProjectAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        this.project._id,
        'transfer-ownership',
        sessionUserId,
        ipAddress,
        {
          previousOwnerId: this.user._id,
          newOwnerId: this.collaborator._id,
        }
      )
    })

    it('should decline to transfer ownership to a non-collaborator', async function () {
      this.project.collaberator_refs = []
      this.project.readOnly_refs = []
      await expect(
        this.handler.promises.transferOwnership(
          this.project._id,
          this.collaborator._id
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
      it('should throw an error', async function () {
        this.UserGetter.promises.getUser.withArgs(fromUserId).resolves(null)
        this.UserGetter.promises.getUser
          .withArgs(toUserId)
          .resolves({ _id: new ObjectId(toUserId) })
        await expect(
          this.handler.promises.transferAllProjectsToUser({
            toUserId,
            fromUserId,
            ipAddress,
          })
        ).to.be.rejectedWith(/missing source user/)

        this.UserGetter.promises.getUser
          .withArgs(fromUserId)
          .resolves({ _id: new ObjectId(fromUserId), email: fromUserEmail })
        this.UserGetter.promises.getUser.withArgs(toUserId).resolves(null)
        await expect(
          this.handler.promises.transferAllProjectsToUser({
            fromUserId,
            toUserId,
            ipAddress,
          })
        ).to.be.rejectedWith(/missing destination user/)
      })
    })

    describe('with the same id', function () {
      it('should throw an error', async function () {
        this.UserGetter.promises.getUser
          .withArgs(fromUserId)
          .resolves({ _id: new ObjectId(fromUserId), email: fromUserEmail })
        await expect(
          this.handler.promises.transferAllProjectsToUser({
            fromUserId,
            toUserId: fromUserId,
            ipAddress,
          })
        ).to.be.rejectedWith(/rejecting transfer between identical users/)
      })
    })

    describe('happy path', function () {
      let tag, fromUserEmail, projects

      beforeEach(function () {
        tag = {
          _id: new ObjectId(),
          name: 'some-tag-name',
        }
        projects = [
          { _id: 'project-1' },
          { _id: 'project-2' },
          { _id: 'project-3' },
        ]

        this.UserGetter.promises.getUser.withArgs(fromUserId).resolves({
          _id: new ObjectId(fromUserId),
          email: fromUserEmail,
        })
        this.UserGetter.promises.getUser.withArgs(toUserId).resolves({
          _id: new ObjectId(toUserId),
        })
        this.ProjectModel.find.resolves(projects)
        this.TagsHandler.promises.createTag.resolves({
          _id: tag._id,
          name: 'some-tag-name',
        })
        this.TagsHandler.promises.addProjectsToTag.resolves()
      })

      it('creates a tag', async function () {
        await this.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(this.TagsHandler.promises.createTag).to.have.been.calledWith(
          toUserId,
          `transferred-from-${fromUserEmail}`,
          '#434AF0',
          { truncate: true }
        )
      })

      it('returns a projectCount, and tag name', async function () {
        const result = await this.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(result.projectCount).to.equal(projects.length)
        expect(result.newTagName).to.equal('some-tag-name')
      })

      it('gets the user records', async function () {
        await this.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(this.UserGetter.promises.getUser).to.have.been.calledWith(
          fromUserId
        )
        expect(this.UserGetter.promises.getUser).to.have.been.calledWith(
          toUserId
        )
      })

      it('gets the list of affected projects', async function () {
        await this.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })
        expect(this.ProjectModel.find).to.have.been.calledWith({
          owner_ref: fromUserId,
        })
      })

      it('transfers all of the projects', async function () {
        await this.handler.promises.transferAllProjectsToUser({
          fromUserId,
          toUserId,
          ipAddress,
        })

        expect(this.ProjectModel.updateOne.callCount).to.equal(3)
        expect(this.TagsHandler.promises.addProjectsToTag.callCount).to.equal(1)

        for (const project of projects) {
          expect(this.ProjectModel.updateOne).to.have.been.calledWith(
            { _id: project._id },
            sinon.match({ $set: { owner_ref: toUserId } })
          )
        }
        expect(
          this.TagsHandler.promises.addProjectsToTag
        ).to.have.been.calledWith(
          toUserId,
          tag._id,
          projects.map(p => p._id)
        )
      })
    })
  })
})
