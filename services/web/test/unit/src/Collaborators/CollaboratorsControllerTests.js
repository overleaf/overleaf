/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Collaborators/CollaboratorsController.js'
const SandboxedModule = require('sandboxed-module')
const events = require('events')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const { ObjectId } = require('mongojs')

describe('CollaboratorsController', function() {
  beforeEach(function() {
    this.CollaboratorsController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './CollaboratorsHandler': (this.CollaboratorsHandler = {}),
        '../Editor/EditorRealTimeController': (this.EditorRealTimeController = {}),
        '../Tags/TagsHandler': (this.TagsHandler = {}),
        '../Authentication/AuthenticationController': (this.AuthenticationController = {}),
        'logger-sharelatex': (this.logger = {
          err: sinon.stub(),
          warn: sinon.stub(),
          log: sinon.stub()
        })
      }
    })
    this.res = new MockResponse()
    this.req = new MockRequest()

    this.project_id = 'project-id-123'
    return (this.callback = sinon.stub())
  })

  describe('removeUserFromProject', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: (this.project_id = 'project-id-123'),
        user_id: (this.user_id = 'user-id-123')
      }
      this.res.sendStatus = sinon.stub()
      this.CollaboratorsHandler.removeUserFromProject = sinon.stub().callsArg(2)
      this.EditorRealTimeController.emitToRoom = sinon.stub()
      this.TagsHandler.removeProjectFromAllTags = sinon.stub().callsArg(2)
      return this.CollaboratorsController.removeUserFromProject(
        this.req,
        this.res
      )
    })

    it('should from the user from the project', function() {
      return this.CollaboratorsHandler.removeUserFromProject
        .calledWith(this.project_id, this.user_id)
        .should.equal(true)
    })

    it('should emit a userRemovedFromProject event to the proejct', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'userRemovedFromProject', this.user_id)
        .should.equal(true)
    })

    it('should send the back a success response', function() {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })

    it('should have called emitToRoom', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'project:membership:changed')
        .should.equal(true)
    })
  })

  describe('removeSelfFromProject', function() {
    beforeEach(function() {
      this.user_id = 'user-id-123'
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns(this.user_id)
      this.req.params = { Project_id: this.project_id }
      this.res.sendStatus = sinon.stub()
      this.CollaboratorsHandler.removeUserFromProject = sinon.stub().callsArg(2)
      this.EditorRealTimeController.emitToRoom = sinon.stub()
      this.TagsHandler.removeProjectFromAllTags = sinon.stub().callsArg(2)
      return this.CollaboratorsController.removeSelfFromProject(
        this.req,
        this.res
      )
    })

    it('should remove the logged in user from the project', function() {
      return this.CollaboratorsHandler.removeUserFromProject
        .calledWith(this.project_id, this.user_id)
        .should.equal(true)
    })

    it('should emit a userRemovedFromProject event to the proejct', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'userRemovedFromProject', this.user_id)
        .should.equal(true)
    })

    it('should remove the project from all tags', function() {
      sinon.assert.calledWith(
        this.TagsHandler.removeProjectFromAllTags,
        this.user_id,
        this.project_id
      )
    })

    it('should return a success code', function() {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('getAllMembers', function() {
    beforeEach(function() {
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns((this.user_id = 'user-id-123'))
      this.req.params = { Project_id: this.project_id }
      this.res.json = sinon.stub()
      this.next = sinon.stub()
      this.members = [{ a: 1 }]
      this.CollaboratorsHandler.getAllInvitedMembers = sinon
        .stub()
        .callsArgWith(1, null, this.members)
      return this.CollaboratorsController.getAllMembers(
        this.req,
        this.res,
        this.next
      )
    })

    it('should not produce an error', function() {
      return this.next.callCount.should.equal(0)
    })

    it('should produce a json response', function() {
      this.res.json.callCount.should.equal(1)
      return this.res.json
        .calledWith({ members: this.members })
        .should.equal(true)
    })

    it('should call CollaboratorsHandler.getAllMembers', function() {
      return this.CollaboratorsHandler.getAllInvitedMembers.callCount.should.equal(
        1
      )
    })

    describe('when CollaboratorsHandler.getAllInvitedMembers produces an error', function() {
      beforeEach(function() {
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        this.CollaboratorsHandler.getAllInvitedMembers = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        return this.CollaboratorsController.getAllMembers(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function() {
        this.next.callCount.should.equal(1)
        return this.next.firstCall.args[0].should.be.instanceof(Error)
      })

      it('should not produce a json response', function() {
        return this.res.json.callCount.should.equal(0)
      })
    })
  })
})
