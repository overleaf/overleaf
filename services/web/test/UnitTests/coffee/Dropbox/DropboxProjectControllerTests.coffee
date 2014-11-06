SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Dropbox/DropboxProjectController.js'

describe 'DropboxProjectController', ->
	beforeEach ->
		@DropboxProjectController = SandboxedModule.require modulePath, requires:
			'./DropboxHandler': @DropboxHandler = {}
			'../Project/ProjectGetter': @ProjectGetter = {}
			'logger-sharelatex':
				log:->
				err:->

		@project_id = "project-id-123"
		@user_id = "user-id-123"
		@req = {}
		@res =
			json: sinon.stub()

	describe "getStatus", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, { owner_ref: @user_id })
			@DropboxHandler.getUserRegistrationStatus = sinon.stub().callsArgWith(1, null, @status = {"mock": "status"})
			@DropboxProjectController.getStatus @req, @res

		it "should look up the project owner", ->
			@ProjectGetter.getProject
				.calledWith(@project_id, {owner_ref: 1})
				.should.equal true
				
		it "should get the owner's Dropbox status", ->
			@DropboxHandler.getUserRegistrationStatus
				.calledWith(@user_id)
				.should.equal true
				
		it "should send the status to the client", ->
			@res.json.calledWith(@status).should.equal true
