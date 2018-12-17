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
		@ownerId = 'owner'
		@project =
			_id: @projectId
			publicAccesLevel: 'tokenBased'
			tokens:
				readOnly: @readOnlyToken
				readAndWrite: @readAndWriteToken
			owner_ref: @ownerId
		@userId = ObjectId()
		@TokenAccessController = SandboxedModule.require modulePath, requires:
			'../Project/ProjectController': @ProjectController = {}
			'../Authentication/AuthenticationController': @AuthenticationController = {}
			'./TokenAccessHandler': @TokenAccessHandler = {
				getV1DocInfo: sinon.stub().yields(null, {
					allow: true
					exists: true
					exported: false
				})
			}
			'logger-sharelatex': {log: sinon.stub(), err: sinon.stub()}
			'settings-sharelatex': {
				overleaf:
					host: 'http://overleaf.test:5000'
			}
			'../V1/V1Api': @V1Api = {
				request: sinon.stub().callsArgWith(1, null, {}, { allow: true })
			}

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
					.callsArgWith(1, null, @project, true)
				@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
					.callsArgWith(2, null)
				@ProjectController.loadEditor = sinon.stub()
				@AuthenticationController.setRedirectInSession = sinon.stub()
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

		describe 'when the user is already the owner', ->
			beforeEach ->
				@req = new MockRequest()
				@res = new MockResponse()
				@next = sinon.stub()
				@req.params['read_and_write_token'] = @readAndWriteToken
				@project.owner_ref = @userId
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, @project, true)
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

			it 'should pass control to loadEditor', (done) ->
				expect(@req.params.Project_id).to.equal @projectId.toString()
				expect(@ProjectController.loadEditor.callCount).to.equal 1
				expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal true
				done()


		describe 'when there is no user', ->
			beforeEach ->
				@AuthenticationController.getLoggedInUserId =
					sinon.stub().returns(null)

			describe 'when anonymous read-write access is enabled', ->
				beforeEach ->
					@TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = true
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_and_write_token'] = @readAndWriteToken
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, @project, true)
					@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessHandler.grantSessionTokenAccess = sinon.stub()
					@TokenAccessController.readAndWriteToken @req, @res, @next

				it 'should not add the user to the project with read-write access', (done) ->
					expect(@TokenAccessHandler.addReadAndWriteUserToProject.callCount)
						.to.equal 0
					done()

				it 'should give the user session token access', (done) ->
					expect(@TokenAccessHandler.grantSessionTokenAccess.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.grantSessionTokenAccess.calledWith(
						@req, @projectId, @readAndWriteToken
					))
						.to.equal true
					done()

				it 'should pass control to loadEditor', (done) ->
					expect(@req.params.Project_id).to.equal @projectId.toString()
					expect(@ProjectController.loadEditor.callCount).to.equal 1
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal true
					done()

			describe 'when anonymous read-write access is not enabled', ->
				beforeEach ->
					@TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = false
					@req = new MockRequest()
					@res = new MockResponse()
					@res.redirect = sinon.stub()
					@next = sinon.stub()
					@req.params['read_and_write_token'] = @readAndWriteToken
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, @project, true)
					@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
						.callsArgWith(2, null)
					@ProjectController.loadEditor = sinon.stub()
					@TokenAccessHandler.grantSessionTokenAccess = sinon.stub()
					@AuthenticationController.setRedirectInSession = sinon.stub()
					@TokenAccessController.readAndWriteToken @req, @res, @next

				it 'should not add the user to the project with read-write access', (done) ->
					expect(@TokenAccessHandler.addReadAndWriteUserToProject.callCount)
						.to.equal 0
					done()

				it 'should give the user session token access', (done) ->
					expect(@TokenAccessHandler.grantSessionTokenAccess.callCount)
						.to.equal 0
					done()

				it 'should not pass control to loadEditor', (done) ->
					expect(@ProjectController.loadEditor.callCount).to.equal 0
					expect(@ProjectController.loadEditor.calledWith(@req, @res, @next)).to.equal false
					done()

				it 'should set redirect in session', (done) ->
					expect(@AuthenticationController.setRedirectInSession.callCount).to.equal 1
					expect(@AuthenticationController.setRedirectInSession.calledWith(@req)).to.equal true
					done()

				it 'should redirect to restricted page', (done) ->
					expect(@res.redirect.callCount).to.equal 1
					expect(@res.redirect.calledWith('/restricted')).to.equal true
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

			describe 'when user is present', ->
				beforeEach ->
					@AuthenticationController.getLoggedInUserId =
						sinon.stub().returns(@userId.toString())

				describe 'when project does not exist', ->
					beforeEach ->
						@req = new MockRequest()
						@req.url = '/123abc'
						@res = new MockResponse()
						@res.redirect = sinon.stub()
						@next = sinon.stub()
						@req.params['read_and_write_token'] = '123abc'
						@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
							.callsArgWith(1, null, null, false)

					describe 'when project was not exported from v1', ->
						beforeEach ->
							@TokenAccessHandler.checkV1ProjectExported = sinon.stub()
								.callsArgWith(1, null, false)
							@TokenAccessController.readAndWriteToken @req, @res, @next

						it 'should redirect to v1', (done) ->
							expect(@res.redirect.callCount).to.equal 1
							expect(@res.redirect.calledWith(
								302,
								'/sign_in_to_v1?return_to=/123abc'
							)).to.equal true
							done()

					describe 'when project was exported from v1', ->
						beforeEach ->
							@TokenAccessHandler.checkV1ProjectExported = sinon.stub()
								.callsArgWith(1, null, false)
							@TokenAccessController.readAndWriteToken @req, @res, @next

						it 'should call next with a not-found error', (done) ->
							expect(@next.callCount).to.equal 0
							done()

				describe 'when token access is off, but user has higher access anyway', ->
					beforeEach ->
						@req = new MockRequest()
						@res = new MockResponse()
						@res.redirect = sinon.stub()
						@next = sinon.stub()
						@req.params['read_and_write_token'] = @readAndWriteToken
						@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
							.callsArgWith(1, null, null, true)
						@TokenAccessHandler.findProjectWithHigherAccess =
							sinon.stub()
							.callsArgWith(2, null, @project)
						@TokenAccessHandler.addReadAndWriteUserToProject = sinon.stub()
							.callsArgWith(2, null)
						@ProjectController.loadEditor = sinon.stub()
						@TokenAccessController.readAndWriteToken @req, @res, @next

					it 'should try to find a project with this token', (done) ->
						expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
							.to.equal 1
						expect(@TokenAccessHandler.findProjectWithReadAndWriteToken
							.calledWith(@readAndWriteToken)
						).to.equal true
						done()

					it 'should check if user has higher access to the token project', (done) ->
						expect(
							@TokenAccessHandler.findProjectWithHigherAccess.callCount
						).to.equal 1
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

				describe 'when higher access is not available', ->
					beforeEach ->
						@req = new MockRequest()
						@res = new MockResponse()
						@next = sinon.stub()
						@req.params['read_and_write_token'] = @readAndWriteToken
						@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
							.callsArgWith(1, null, null, true)
						@TokenAccessHandler.findProjectWithHigherAccess =
							sinon.stub()
							.callsArgWith(2, null, null)
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

					it 'should check if user has higher access to the token project', (done) ->
						expect(
							@TokenAccessHandler.findProjectWithHigherAccess.callCount
						).to.equal 1
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
					.callsArgWith(1, null, @project, true)
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
			@TokenAccessHandler.checkV1Access = sinon.stub().callsArgWith(1, null, true)

		describe 'when access not allowed by v1 api', ->
			beforeEach ->
				@req = new MockRequest()
				@res = new MockResponse()
				@res.redirect = sinon.stub()
				@next = sinon.stub()
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, @project, true)
				@TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
					allow: false
					exists: true
					exported: false
					published_path: 'doc-url'
				})
				@TokenAccessController.readOnlyToken @req, @res, @next

			it 'should redirect to doc-url', ->
				expect(@res.redirect.calledWith('doc-url')).to.equal true

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
						.callsArgWith(1, null, @project, true)
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

			describe 'when the user is already the owner', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@project.owner_ref = @userId
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, @project, true)
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
			describe 'when project does not exist', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@res.redirect = sinon.stub()
					@next = sinon.stub()
					@req.params['read_only_token'] = 'abcd'
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, null, false)
					@TokenAccessHandler.checkV1ProjectExported = sinon.stub()
						.callsArgWith(1, null, false)
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should redirect to v1', (done) ->
					expect(@res.redirect.callCount).to.equal 1
					expect(@res.redirect.calledWith(
						302,
						'/sign_in_to_v1?return_to=/read/abcd'
					)).to.equal true
					done()

			describe 'when project was exported from v1', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@res.redirect = sinon.stub()
					@next = sinon.stub()
					@req.params['read_only_token'] = 'abcd'
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, null, false)
					@TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
						allow: true
						exists: true
						exported: true
					})
					@TokenAccessController.readOnlyToken @req, @res, @next

				it 'should call next with a not-found error', (done) ->
					expect(@next.callCount).to.equal 1
					done()

			describe 'when token access is off, but user has higher access anyway', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@res.redirect = sinon.stub()
					@next = sinon.stub()
					@req.params['read_and_write_token'] = @readAndWriteToken
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, null, true)
					@TokenAccessHandler.findProjectWithHigherAccess =
						sinon.stub()
						.callsArgWith(2, null, @project)
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

				it 'should check if user has higher access to the token project', (done) ->
					expect(
						@TokenAccessHandler.findProjectWithHigherAccess.callCount
					).to.equal 1
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

			describe 'when higher access is not available', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_and_write_token'] = @readAndWriteToken
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, null, true)
					@TokenAccessHandler.findProjectWithHigherAccess =
						sinon.stub()
						.callsArgWith(2, null, null)
					@TokenAccessHandler.addReadOnlyUserToProject = sinon.stub()
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

				it 'should check if user has higher access to the token project', (done) ->
					expect(
						@TokenAccessHandler.findProjectWithHigherAccess.callCount
					).to.equal 1
					done()

				it 'should not add the user to the project with read-write access', (done) ->
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
					.callsArgWith(1, null, @project, true)
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
				@TokenAccessHandler.grantSessionTokenAccess = sinon.stub()

			describe 'when all goes well', ->
				beforeEach ->
					@req = new MockRequest()
					@res = new MockResponse()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, @project, true)
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
					expect(@TokenAccessHandler.grantSessionTokenAccess.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.grantSessionTokenAccess.calledWith(
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
					expect(@req._anonymousAccessToken).to.equal @readOnlyToken
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
					expect(@TokenAccessHandler.grantSessionTokenAccess.callCount)
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
					@res.redirect = sinon.stub()
					@next = sinon.stub()
					@req.params['read_only_token'] = @readOnlyToken
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, null)
					@TokenAccessHandler.checkV1ProjectExported = sinon.stub()
						.callsArgWith(1, null, false)
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
					expect(@TokenAccessHandler.grantSessionTokenAccess.callCount)
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

				describe 'when project was exported to v2', ->
					beforeEach ->
						@TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
							allow: true
							exists: true
							exported: true
						})
						@TokenAccessController.readOnlyToken @req, @res, @next

					it 'should redirect to v1', (done) ->
						expect(@res.redirect.callCount).to.equal 1
						expect(@res.redirect.calledWith(
							302,
							"/sign_in_to_v1?return_to=/read/#{@readOnlyToken}"
						)).to.equal true
						done()

