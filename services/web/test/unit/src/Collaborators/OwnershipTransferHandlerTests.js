const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const PrivilegeLevels = require('../../../../app/src/Features/Authorization/PrivilegeLevels')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const { ObjectId } = require('mongodb')

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/OwnershipTransferHandler'

describe('OwnershipTransferHandler', function() {
  beforeEach(function() {
    this.user = { _id: ObjectId(), email: 'owner@example.com' }
    this.collaborator = { _id: ObjectId(), email: 'collaborator@example.com' }
    this.project = {
      _id: ObjectId(),
      name: 'project',
      owner_ref: this.user._id,
      collaberator_refs: [this.collaborator._id]
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project)
      }
    }
    this.ProjectModel = {
      update: sinon.stub().returns({
        exec: sinon.stub().resolves()
      })
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(this.user)
      }
    }
    this.TpdsUpdateSender = {
      promises: {
        moveEntity: sinon.stub().resolves()
      }
    }
    this.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves()
      }
    }
    this.CollaboratorsHandler = {
      promises: {
        removeUserFromProject: sinon.stub().resolves(),
        addUserIdToProject: sinon.stub().resolves()
      }
    }
    this.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves()
      }
    }
    this.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves()
      }
    }
    this.handler = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        '../Project/ProjectGetter': this.ProjectGetter,
        '../../models/Project': {
          Project: this.ProjectModel
        },
        '../User/UserGetter': this.UserGetter,
        '../ThirdPartyDataStore/TpdsProjectFlusher': this.TpdsProjectFlusher,
        '../Project/ProjectAuditLogHandler': this.ProjectAuditLogHandler,
        '../Email/EmailHandler': this.EmailHandler,
        './CollaboratorsHandler': this.CollaboratorsHandler,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        '../Errors/Errors': Errors
      }
    })
  })

  describe('transferOwnership', function() {
    beforeEach(function() {
      this.UserGetter.promises.getUser
        .withArgs(this.user._id)
        .resolves(this.user)
      this.UserGetter.promises.getUser
        .withArgs(this.collaborator._id)
        .resolves(this.collaborator)
    })

    it("should return a not found error if the project can't be found", async function() {
      this.ProjectGetter.promises.getProject.resolves(null)
      await expect(
        this.handler.promises.transferOwnership('abc', this.collaborator._id)
      ).to.be.rejectedWith(Errors.ProjectNotFoundError)
    })

    it("should return a not found error if the user can't be found", async function() {
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

    it('should return an error if user cannot be removed as collaborator ', async function() {
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

    it('should transfer ownership of the project', async function() {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(this.ProjectModel.update).to.have.been.calledWith(
        { _id: this.project._id },
        sinon.match({ $set: { owner_ref: this.collaborator._id } })
      )
    })

    it('should do nothing if transferring back to the owner', async function() {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.user._id
      )
      expect(this.ProjectModel.update).not.to.have.been.called
    })

    it("should remove the user from the project's collaborators", async function() {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(
        this.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(this.project._id, this.collaborator._id)
    })

    it('should add the former project owner as a read/write collaborator', async function() {
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

    it('should flush the project to tpds', async function() {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(
        this.TpdsProjectFlusher.promises.flushProjectToTpds
      ).to.have.been.calledWith(this.project._id)
    })

    it('should send an email notification', async function() {
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id
      )
      expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'ownershipTransferConfirmationPreviousOwner',
        {
          to: this.user.email,
          project: this.project,
          newOwner: this.collaborator
        }
      )
      expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'ownershipTransferConfirmationNewOwner',
        {
          to: this.collaborator.email,
          project: this.project,
          previousOwner: this.user
        }
      )
    })

    it('should write an entry in the audit log', async function() {
      const sessionUserId = ObjectId()
      await this.handler.promises.transferOwnership(
        this.project._id,
        this.collaborator._id,
        { sessionUserId }
      )
      expect(
        this.ProjectAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        this.project._id,
        'transfer-ownership',
        sessionUserId,
        {
          previousOwnerId: this.user._id,
          newOwnerId: this.collaborator._id
        }
      )
    })

    it('should decline to transfer ownership to a non-collaborator', async function() {
      this.project.collaberator_refs = []
      await expect(
        this.handler.promises.transferOwnership(
          this.project._id,
          this.collaborator._id
        )
      ).to.be.rejectedWith(Errors.UserNotCollaboratorError)
    })
  })
})
