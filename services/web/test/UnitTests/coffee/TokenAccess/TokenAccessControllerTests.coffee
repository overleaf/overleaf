should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/TokenAccess/TokenAccessController"
expect = require("chai").expect
ObjectId = require("mongojs").ObjectId
MockRequest = require('../helpers/MockRequest')
MockResponse = require('../helpers/MockResponse')
Errors = require "../../../../app/js/Features/Errors/Errors.js"

describe "TokenAccessController", ->

	beforeEach ->
		@readOnlyToken = 'somereadonlytoken'
		@readAndWriteToken = '42somereadandwritetoken'
		@projectId = ObjectId()
		@project =
			_id: @projectId
			publicAccesLevel: 'tokenBased'
			tokens:
				readOnly: @readOnlyToken
				readAndWrite: @readAndWriteToken
		@userId = ObjectId()
		@TokenAccessController = SandboxedModule.require modulePath, requires:
			'../Project/ProjectController': @ProjectController = {}
			'../Authentication/AuthenticationController': @AuthenticationController = {}
			'./TokenAccessHandler': @TokenAccessHandler = {}
			'logger-sharelatex': {log: sinon.stub(), err: sinon.stub()}

		@AuthenticationController.getLoggedInUserId = sinon.stub().returns(@userId.toString())


	describe 'readAndWriteToken', ->
		beforeEach ->

		describe 'when all goes well', ->
			beforeEach ->
				@req = new MockRequest()
				@res = new MockResponse()
				@next = sinon.stub()
				@req.params['read_and_write_token'] = @readAndWriteToken
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, @project)
				@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
					.callsArgWith(2, null)
				@ProjectController.loadEditor = sinon.stub()
				@TokenAccessController.readAndWriteToken @req, @res, @next

			it 'should try to find a project with this token', (done) ->
				expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
					.to.equal 1
				expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(@readAndWriteToken))
					.to.equal true
				done()

			it 'should add the user to the project with read-write access', (done) ->
				expect(@TokenAccessHandler.addReadAndWriteUserToProject.callCount)
					.to.equal 1
				expect(@TokenAccessHandler.addReadAndWriteUserToProject.calledWith(
					@userId.toString(), @projectId
				))
					.to.equal true
				done()

			it 'should pass control to loadEditor', (done) ->
				expect(@req.params.Project_id).to.equal @projectId.toString()
				expect(@ProjectController.loadEditor.callCount).to.equal 1
				expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal true
				done()

		describe 'when findProject produces an error', ->
			beforeEach ->
				@req = new MockRequest()
				@res = new MockResponse()
				@next = sinon.stub()
				@req.params['read_and_write_token'] = @readAndWriteToken
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, new Error('woops'))
				@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
					.callsArgWith(2, null)
				@ProjectController.loadEditor = sinon.stub()
				@TokenAccessController.readAndWriteToken @req, @res, @next

			it 'should try to find a project with this token', (done) ->
				expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
					.to.equal 1
				expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(@readAndWriteToken))
					.to.equal true
				done()

			it 'should not add the user to the project with read-write access', (done) ->
				expect(@TokenAccessHandler.addReadAndWriteUserToProject.callCount)
					.to.equal 0
				done()

			it 'should not pass control to loadEditor', (done) ->
				expect(@ProjectController.loadEditor.callCount).to.equal 0
				expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
				done()

			it 'should call next with an error', (done) ->
				expect(@next.callCount).to.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error
				done()

		describe 'when findProject does not find a project', ->
			beforeEach ->

			describe 'when it is a private overleaf project', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@res.redirect = sinon.stub()
					@next = sinon.stub()
					@req.params['read_and_write_token'] = @readAndWriteToken
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, null)
					@TokenAccessHandler.findPrivateOverleafProjectWithReadAndWriteToken =
						sinon.stub()
						.callsArgWith(1, null, @project)
					@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readAndWriteToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(@readAndWriteToken))
						.to.equal true
					done()

				it 'should try to find a private overleaf project', (done) ->
					expect(
						@TokenAccessHandler.findPrivateOverleafProjectWithReadAndWriteToken
							.callCount
					).to.equal 1
					expect(
						@TokenAccessHandler.findPrivateOverleafProjectWithReadAndWriteToken
							.calledWith(@readAndWriteToken)
					).to.equal true
					done()

				it 'should not add the user to the project with read-write access', (done) ->
					expect(@TokenAccessHandler.addReadAndWriteUserToProject.callCount)
						.to.equal 0
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should not call next with a not-found error', (done) ->
					expect(@next.callCount).to.equal 0
					done()

				it 'should redirect to the canonical project url', (done) ->
					expect(@res.redirect.callCount).to.equal 1
					expect(@res.redirect.calledWith(302, "/project/#{@project._id}")).to.equal true
					done()

			describe 'when it is not a private overleaf project', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_and_write_token'] = @readAndWriteToken
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, null)
					@TokenAccessHandler.findPrivateOverleafProjectWithReadAndWriteToken =
						sinon.stub()
						.callsArgWith(1, null, null)
					@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readAndWriteToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
						@readAndWriteToken
					)).to.equal true
					done()

				it 'should not add the user to the project with read-write access', (done) ->
					expect(@TokenAccessHandler.addReadAndWriteUserToProject.callCount)
						.to.equal 0
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should call next with a not-found error', (done) ->
					expect(@next.callCount).to.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error
					done()

		describe 'when adding user to project produces an error', ->
			beforeEach ->
				@req = new MockRequest()
				@res = new MockResponse()
				@next = sinon.stub()
				@req.params['read_and_write_token'] = @readAndWriteToken
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, @project)
				@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
					.callsArgWith(2, new Error('woops'))
				@ProjectController.loadEditor = sinon.stub()
				@TokenAccessController.readAndWriteToken @req, @res, @next

			it 'should try to find a project with this token', (done) ->
				expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
					.to.equal 1
				expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(@readAndWriteToken))
					.to.equal true
				done()

			it 'should add the user to the project with read-write access', (done) ->
				expect(@TokenAccessHandler.addReadAndWriteUserToProject.callCount)
					.to.equal 1
				expect(@TokenAccessHandler.addReadAndWriteUserToProject.calledWith(
					@userId.toString(), @projectId
				))
					.to.equal true
				done()

			it 'should not pass control to loadEditor', (done) ->
				expect(@ProjectController.loadEditor.callCount).to.equal 0
				expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
				done()

			it 'should call next with an error', (done) ->
				expect(@next.callCount).to.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error
				done()


	describe 'readOnlyToken', ->
		beforeEach ->

		describe 'with a user', ->
			beforeEach ->
				@AuthenticationController.getLoggedInUserId = sinon.stub().returns(@userId.toString())

			describe 'when all goes well', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, @project)
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(@readOnlyToken))
						.to.equal true
					done()

				it 'should add the user to the project with read-only access', (done) ->
					expect(@TokenAccessHandler.addReadOnlyUserToProject.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.addReadOnlyUserToProject.calledWith(
						@userId.toString(), @projectId
					))
						.to.equal true
					done()

				it 'should pass control to loadEditor', (done) ->
					expect(@req.params.Project_id).to.equal @projectId.toString()
					expect(@ProjectController.loadEditor.callCount).to.equal 1
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal true
					done()
					
			describe 'when findProject produces an error', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, new Error('woops'))
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(@readOnlyToken))
						.to.equal true
					done()

				it 'should not add the user to the project with read-only access', (done) ->
					expect(@TokenAccessHandler.addReadOnlyUserToProject.callCount)
						.to.equal 0
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should call next with an error', (done) ->
					expect(@next.callCount).to.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error
					done()

			describe 'when findProject does not find a project', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, null)
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(@readOnlyToken))
						.to.equal true
					done()

				it 'should not add the user to the project with read-only access', (done) ->
					expect(@TokenAccessHandler.addReadOnlyUserToProject.callCount)
						.to.equal 0
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should call next with a not-found error', (done) ->
					expect(@next.callCount).to.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error
					done()

			describe 'when adding user to project produces an error', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, @project)
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
						.callsArgWith(2, new Error('woops'))
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(@readOnlyToken))
						.to.equal true
					done()

				it 'should add the user to the project with read-only access', (done) ->
					expect(@TokenAccessHandler.addReadOnlyUserToProject.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.addReadOnlyUserToProject.calledWith(
						@userId.toString(), @projectId
					))
						.to.equal true
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should call next with an error', (done) ->
					expect(@next.callCount).to.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error
					done()



		describe 'anonymous', ->
			beforeEach ->
				@AuthenticationController.getLoggedInUserId = sinon.stub().returns(null)
				@TokenAccessHandler.grantSessionReadOnlyTokenAccess = sinon.stub()

			describe 'when all goes well', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, @project)
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(@readOnlyToken))
						.to.equal true
					done()

				it 'should give the user session read-only access', (done) ->
					expect(@TokenAccessHandler.grantSessionReadOnlyTokenAccess.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.grantSessionReadOnlyTokenAccess.calledWith(
						@req, @projectId, @readOnlyToken
					))
						.to.equal true
					done()

				it 'should not add the user to the project with read-only access', (done) ->
					expect(@TokenAccessHandler.addReadOnlyUserToProject.callCount)
						.to.equal 0
					done()

				it 'should pass control to loadEditor', (done) ->
					expect(@req.params.Project_id).to.equal @projectId.toString()
					expect(@req._anonToken).to.equal @readOnlyToken
					expect(@ProjectController.loadEditor.callCount).to.equal 1
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal true
					done()

			describe 'when findProject produces an error', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, new Error('woops'))
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(@readOnlyToken))
						.to.equal true
					done()

				it 'should not give the user session read-only access', (done) ->
					expect(@TokenAccessHandler.grantSessionReadOnlyTokenAccess.callCount)
						.to.equal 0
					done()

				it 'should not add the user to the project with read-only access', (done) ->
					expect(@TokenAccessHandler.addReadOnlyUserToProject.callCount)
						.to.equal 0
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should call next with an error', (done) ->
					expect(@next.callCount).to.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error
					done()

			describe 'when findProject does not find a project', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, null)
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should try to find a project with this token', (done) ->
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(@readOnlyToken))
						.to.equal true
					done()

				it 'should not give the user session read-only access', (done) ->
					expect(@TokenAccessHandler.grantSessionReadOnlyTokenAccess.callCount)
						.to.equal 0
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should not add the user to the project with read-only access', (done) ->
					expect(@TokenAccessHandler.addReadOnlyUserToProject.callCount)
						.to.equal 0
					done()

				it 'should call next with a not-found error', (done) ->
					expect(@next.callCount).to.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error
					done()

