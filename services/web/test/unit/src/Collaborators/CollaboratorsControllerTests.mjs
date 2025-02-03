import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsController.mjs'

describe('CollaboratorsController', function () {
  beforeEach(async function () {
    this.res = new MockResponse()
    this.req = new MockRequest()

    this.user = { _id: new ObjectId() }
    this.projectId = new ObjectId()
    this.callback = sinon.stub()

    this.CollaboratorsHandler = {
      promises: {
        removeUserFromProject: sinon.stub().resolves(),
        setCollaboratorPrivilegeLevel: sinon.stub().resolves(),
      },
      createTokenHashPrefix: sinon.stub().returns('abc123'),
    }
    this.CollaboratorsGetter = {
      promises: {
        getAllInvitedMembers: sinon.stub(),
      },
    }
    this.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }
    this.HttpErrorHandler = {
      forbidden: sinon.stub(),
      notFound: sinon.stub(),
    }
    this.TagsHandler = {
      promises: {
        removeProjectFromAllTags: sinon.stub().resolves(),
      },
    }
    this.SessionManager = {
      getSessionUser: sinon.stub().returns(this.user),
      getLoggedInUserId: sinon.stub().returns(this.user._id),
    }
    this.OwnershipTransferHandler = {
      promises: {
        transferOwnership: sinon.stub().resolves(),
      },
    }
    this.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns('access-token'),
    }

    this.ProjectAuditLogHandler = {
      addEntryInBackground: sinon.stub(),
    }

    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves({ owner_ref: this.user._id }),
      },
    }

    this.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    this.LimitationsManager = {
      promises: {
        canAddXEditCollaborators: sinon.stub().resolves(),
      },
    }

    this.CollaboratorsController = await esmock.strict(MODULE_PATH, {
      'mongodb-legacy': { ObjectId },
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler.js':
        this.CollaboratorsHandler,
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter.js':
        this.CollaboratorsGetter,
      '../../../../app/src/Features/Collaborators/OwnershipTransferHandler.js':
        this.OwnershipTransferHandler,
      '../../../../app/src/Features/Editor/EditorRealTimeController':
        this.EditorRealTimeController,
      '../../../../app/src/Features/Errors/HttpErrorHandler.js':
        this.HttpErrorHandler,
      '../../../../app/src/Features/Tags/TagsHandler.js': this.TagsHandler,
      '../../../../app/src/Features/Authentication/SessionManager.js':
        this.SessionManager,
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler.js':
        this.TokenAccessHandler,
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.js':
        this.ProjectAuditLogHandler,
      '../../../../app/src/Features/Project/ProjectGetter.js':
        this.ProjectGetter,
      '../../../../app/src/Features/SplitTests/SplitTestHandler.js':
        this.SplitTestHandler,
      '../../../../app/src/Features/Subscription/LimitationsManager.js':
        this.LimitationsManager,
    })
  })

  describe('removeUserFromProject', function () {
    beforeEach(function (done) {
      this.req.params = {
        Project_id: this.projectId,
        user_id: this.user._id,
      }
      this.res.sendStatus = sinon.spy(() => {
        done()
      })
      this.CollaboratorsController.removeUserFromProject(this.req, this.res)
    })

    it('should from the user from the project', function () {
      expect(
        this.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(this.projectId, this.user._id)
    })

    it('should emit a userRemovedFromProject event to the proejct', function () {
      expect(this.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        this.projectId,
        'userRemovedFromProject',
        this.user._id
      )
    })

    it('should send the back a success response', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })

    it('should have called emitToRoom', function () {
      expect(this.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        this.projectId,
        'project:membership:changed'
      )
    })

    it('should write a project audit log', function () {
      this.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
        this.projectId,
        'remove-collaborator',
        this.user._id,
        this.req.ip,
        { userId: this.user._id }
      )
    })
  })

  describe('removeSelfFromProject', function () {
    beforeEach(function (done) {
      this.req.params = { Project_id: this.projectId }
      this.res.sendStatus = sinon.spy(() => {
        done()
      })
      this.CollaboratorsController.removeSelfFromProject(this.req, this.res)
    })

    it('should remove the logged in user from the project', function () {
      expect(
        this.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(this.projectId, this.user._id)
    })

    it('should emit a userRemovedFromProject event to the proejct', function () {
      expect(this.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        this.projectId,
        'userRemovedFromProject',
        this.user._id
      )
    })

    it('should remove the project from all tags', function () {
      expect(
        this.TagsHandler.promises.removeProjectFromAllTags
      ).to.have.been.calledWith(this.user._id, this.projectId)
    })

    it('should return a success code', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })

    it('should write a project audit log', function () {
      this.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
        this.projectId,
        'leave-project',
        this.user._id,
        this.req.ip
      )
    })
  })

  describe('getAllMembers', function () {
    beforeEach(function (done) {
      this.req.params = { Project_id: this.projectId }
      this.res.json = sinon.spy(() => {
        done()
      })
      this.next = sinon.stub()
      this.members = [{ a: 1 }]
      this.CollaboratorsGetter.promises.getAllInvitedMembers.resolves(
        this.members
      )
      this.CollaboratorsController.getAllMembers(this.req, this.res, this.next)
    })

    it('should not produce an error', function () {
      this.next.callCount.should.equal(0)
    })

    it('should produce a json response', function () {
      this.res.json.callCount.should.equal(1)
      this.res.json.calledWith({ members: this.members }).should.equal(true)
    })

    it('should call CollaboratorsGetter.getAllInvitedMembers', function () {
      expect(this.CollaboratorsGetter.promises.getAllInvitedMembers).to.have
        .been.calledOnce
    })

    describe('when CollaboratorsGetter.getAllInvitedMembers produces an error', function () {
      beforeEach(function (done) {
        this.res.json = sinon.stub()
        this.next = sinon.spy(() => {
          done()
        })
        this.CollaboratorsGetter.promises.getAllInvitedMembers.rejects(
          new Error('woops')
        )
        this.CollaboratorsController.getAllMembers(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function () {
        expect(this.next).to.have.been.calledOnce
        expect(this.next).to.have.been.calledWithMatch(
          sinon.match.instanceOf(Error)
        )
      })

      it('should not produce a json response', function () {
        this.res.json.callCount.should.equal(0)
      })
    })
  })

  describe('setCollaboratorInfo', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.projectId,
        user_id: this.user._id,
      }
      this.req.body = { privilegeLevel: 'readOnly' }
    })

    it('should set the collaborator privilege level', function (done) {
      this.res.sendStatus = status => {
        expect(status).to.equal(204)
        expect(
          this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
        ).to.have.been.calledWith(this.projectId, this.user._id, 'readOnly')
        done()
      }
      this.CollaboratorsController.setCollaboratorInfo(this.req, this.res)
    })

    it('should return a 404 when the project or collaborator is not found', function (done) {
      this.HttpErrorHandler.notFound = sinon.spy((req, res) => {
        expect(req).to.equal(this.req)
        expect(res).to.equal(this.res)
        done()
      })

      this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel.rejects(
        new Errors.NotFoundError()
      )
      this.CollaboratorsController.setCollaboratorInfo(this.req, this.res)
    })

    it('should pass the error to the next handler when setting the privilege level fails', function (done) {
      this.next = sinon.spy(err => {
        expect(err).instanceOf(Error)
        done()
      })

      this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel.rejects(
        new Error()
      )
      this.CollaboratorsController.setCollaboratorInfo(
        this.req,
        this.res,
        this.next
      )
    })

    describe('when setting privilege level to readAndWrite', function () {
      beforeEach(function () {
        this.req.body = { privilegeLevel: 'readAndWrite' }
      })

      describe('when owner can add new edit collaborators', function () {
        beforeEach(function () {
          this.LimitationsManager.promises.canAddXEditCollaborators.resolves(
            true
          )
        })

        it('should set privilege level after checking collaborators can be added', function (done) {
          this.res.sendStatus = status => {
            expect(status).to.equal(204)
            expect(
              this.LimitationsManager.promises.canAddXEditCollaborators
            ).to.have.been.calledWith(this.projectId, 1)
            done()
          }
          this.CollaboratorsController.setCollaboratorInfo(this.req, this.res)
        })
      })

      describe('when owner cannot add edit collaborators', function () {
        beforeEach(function () {
          this.LimitationsManager.promises.canAddXEditCollaborators.resolves(
            false
          )
        })

        it('should return a 403 if trying to set a new edit collaborator', function (done) {
          this.HttpErrorHandler.forbidden = sinon.spy((req, res) => {
            expect(req).to.equal(this.req)
            expect(res).to.equal(this.res)
            expect(
              this.LimitationsManager.promises.canAddXEditCollaborators
            ).to.have.been.calledWith(this.projectId, 1)
            expect(
              this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
            ).to.not.have.been.called
            done()
          })
          this.CollaboratorsController.setCollaboratorInfo(this.req, this.res)
        })
      })
    })

    describe('when setting privilege level to readOnly', function () {
      beforeEach(function () {
        this.req.body = { privilegeLevel: 'readOnly' }
      })

      describe('when owner cannot add edit collaborators', function () {
        beforeEach(function () {
          this.LimitationsManager.promises.canAddXEditCollaborators.resolves(
            false
          )
        })

        it('should always allow setting a collaborator to viewer even if user cant add edit collaborators', function (done) {
          this.res.sendStatus = status => {
            expect(status).to.equal(204)
            expect(this.LimitationsManager.promises.canAddXEditCollaborators).to
              .not.have.been.called
            expect(
              this.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
            ).to.have.been.calledWith(this.projectId, this.user._id, 'readOnly')
            done()
          }
          this.CollaboratorsController.setCollaboratorInfo(this.req, this.res)
        })
      })
    })
  })

  describe('transferOwnership', function () {
    beforeEach(function () {
      this.req.body = { user_id: this.user._id.toString() }
    })

    it('returns 204 on success', function (done) {
      this.res.sendStatus = status => {
        expect(status).to.equal(204)
        done()
      }
      this.CollaboratorsController.transferOwnership(this.req, this.res)
    })

    it('returns 404 if the project does not exist', function (done) {
      this.HttpErrorHandler.notFound = sinon.spy((req, res, message) => {
        expect(req).to.equal(this.req)
        expect(res).to.equal(this.res)
        expect(message).to.match(/project not found/)
        done()
      })
      this.OwnershipTransferHandler.promises.transferOwnership.rejects(
        new Errors.ProjectNotFoundError()
      )
      this.CollaboratorsController.transferOwnership(this.req, this.res)
    })

    it('returns 404 if the user does not exist', function (done) {
      this.HttpErrorHandler.notFound = sinon.spy((req, res, message) => {
        expect(req).to.equal(this.req)
        expect(res).to.equal(this.res)
        expect(message).to.match(/user not found/)
        done()
      })
      this.OwnershipTransferHandler.promises.transferOwnership.rejects(
        new Errors.UserNotFoundError()
      )
      this.CollaboratorsController.transferOwnership(this.req, this.res)
    })

    it('invokes HTTP forbidden error handler if the user is not a collaborator', function (done) {
      this.HttpErrorHandler.forbidden = sinon.spy(() => done())
      this.OwnershipTransferHandler.promises.transferOwnership.rejects(
        new Errors.UserNotCollaboratorError()
      )
      this.CollaboratorsController.transferOwnership(this.req, this.res)
    })
  })
})
