should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/TokenAccess/TokenAccessHandler"
expect = require("chai").expect
ObjectId = require("mongojs").ObjectId

describe "TokenAccessHandler", ->

	beforeEach ->
		@token = 'sometokenthing'
		@projectId = ObjectId()
		@project =
			_id: @projectId
			publicAccesLevel: 'tokenBased'
		@userId = ObjectId()
		@req = {}
		@TokenAccessHandler = SandboxedModule.require modulePath, requires:
			'../../models/Project': {Project: @Project = {}}
			'settings-sharelatex': @settings = {}
			'../Collaborators/CollaboratorsHandler': @CollaboratorsHandler = {}
			'../User/UserGetter': @UserGetter = {}
			'../V1/V1Api': @V1Api = {
				request: sinon.stub()
			}

	describe 'findProjectWithReadOnlyToken', ->
		beforeEach ->
			@Project.findOne = sinon.stub().callsArgWith(2, null, @project)

		it 'should call Project.findOne', (done) ->
			@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project) =>
				expect(@Project.findOne.callCount).to.equal 1
				expect(@Project.findOne.calledWith({
					'tokens.readOnly': @token
				})).to.equal true
				done()

		it 'should produce a project object with no error', (done) ->
			@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project) =>
				expect(err).to.not.exist
				expect(project).to.exist
				expect(project).to.deep.equal @project
				done()

		it 'should return projectExists flag as true', (done) ->
			@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project, projectExists) ->
				expect(projectExists).to.equal true
				done()

		describe 'when Project.findOne produces an error', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project) =>
					expect(err).to.exist
					expect(project).to.not.exist
					expect(err).to.be.instanceof Error
					done()

		describe 'when project does not have tokenBased access level', ->
			beforeEach ->
				@project.publicAccesLevel = 'private'
				@Project.findOne = sinon.stub().callsArgWith(2, null, @project, true)

			it 'should not return a project', (done) ->
				@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project) ->
					expect(err).to.not.exist
					expect(project).to.not.exist
					done()

			it 'should return projectExists flag as true', (done) ->
				@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project, projectExists) ->
					expect(projectExists).to.equal true
					done()

		describe 'when project does not exist', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, null, null)

			it 'should not return a project', (done) ->
				@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project) ->
					expect(err).to.not.exist
					expect(project).to.not.exist
					done()

			it 'should return projectExists flag as false', (done) ->
				@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project, projectExists) ->
					expect(projectExists).to.equal false
					done()

	describe 'findProjectWithReadAndWriteToken', ->
		beforeEach ->
			@token = '1234bcdf'
			@tokenPrefix = '1234'
			@project.tokens = {
				readOnly: 'atntntn'
				readAndWrite: @token,
				readAndWritePrefix: @tokenPrefix
			}
			@Project.findOne = sinon.stub().callsArgWith(2, null, @project)

		it 'should call Project.findOne', (done) ->
			@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project) =>
				expect(@Project.findOne.callCount).to.equal 1
				expect(@Project.findOne.calledWith({
					'tokens.readAndWritePrefix': @tokenPrefix
				})).to.equal true
				done()

		it 'should produce a project object with no error', (done) ->
			@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project) =>
				expect(err).to.not.exist
				expect(project).to.exist
				expect(project).to.deep.equal @project
				done()

		it 'should return projectExists flag as true', (done) ->
			@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project, projectExists) ->
				expect(projectExists).to.equal true
				done()

		describe 'when Project.findOne produces an error', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project) =>
					expect(err).to.exist
					expect(project).to.not.exist
					expect(err).to.be.instanceof Error
					done()

		describe 'when project does not have tokenBased access level', ->
			beforeEach ->
				@project.publicAccesLevel = 'private'
				@Project.findOne = sinon.stub().callsArgWith(2, null, @project, true)

			it 'should not return a project', (done) ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project) ->
					expect(err).to.not.exist
					expect(project).to.not.exist
					done()

			it 'should return projectExists flag as true', (done) ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project, projectExists) ->
					expect(projectExists).to.equal true
					done()


	describe 'findProjectWithHigherAccess', ->
		describe 'when user does have higher access', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, null, @project)
				@CollaboratorsHandler.isUserInvitedMemberOfProject = sinon.stub()
					.callsArgWith(2, null, true)

			it 'should call Project.findOne', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(@Project.findOne.callCount).to.equal 1
					expect(@Project.findOne.calledWith({
						'tokens.readOnly': @token
					})).to.equal true
					done()

			it 'should call isUserInvitedMemberOfProject', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(@CollaboratorsHandler.isUserInvitedMemberOfProject.callCount)
						.to.equal 1
					expect(@CollaboratorsHandler.isUserInvitedMemberOfProject.calledWith(
						@userId, @project._id
					)).to.equal true
					done()

			it 'should produce a project object', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(err).to.not.exist
					expect(project).to.exist
					expect(project).to.deep.equal @project
					done()

		describe 'when user does not have higher access', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, null, @project)
				@CollaboratorsHandler.isUserInvitedMemberOfProject = sinon.stub()
					.callsArgWith(2, null, false)

			it 'should call Project.findOne', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(@Project.findOne.callCount).to.equal 1
					expect(@Project.findOne.calledWith({
						'tokens.readOnly': @token
					})).to.equal true
					done()

			it 'should call isUserInvitedMemberOfProject', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(@CollaboratorsHandler.isUserInvitedMemberOfProject.callCount)
						.to.equal 1
					expect(@CollaboratorsHandler.isUserInvitedMemberOfProject.calledWith(
						@userId, @project._id
					)).to.equal true
					done()

			it 'should not produce a project', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(err).to.not.exist
					expect(project).to.not.exist
					done()

		describe 'when Project.findOne produces an error', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(err).to.exist
					expect(project).to.not.exist
					expect(err).to.be.instanceof Error
					done()

		describe 'when isUserInvitedMemberOfProject produces an error', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, null, @project)
				@CollaboratorsHandler.isUserInvitedMemberOfProject = sinon.stub()
					.callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@TokenAccessHandler.findProjectWithHigherAccess @token, @userId, (err, project) =>
					expect(err).to.exist
					expect(project).to.not.exist
					expect(err).to.be.instanceof Error
					done()

	describe 'addReadOnlyUserToProject', ->
		beforeEach ->
			@Project.update = sinon.stub().callsArgWith(2, null)

		it 'should call Project.update', (done) ->
			@TokenAccessHandler.addReadOnlyUserToProject @userId, @projectId, (err) =>
				expect(@Project.update.callCount).to.equal 1
				expect(@Project.update.calledWith({
					_id: @projectId
				})).to.equal true
				expect(@Project.update.lastCall.args[1]['$addToSet'])
					.to.have.keys 'tokenAccessReadOnly_refs'
				done()

		it 'should not produce an error', (done) ->
			@TokenAccessHandler.addReadOnlyUserToProject @userId, @projectId, (err) =>
				expect(err).to.not.exist
				done()

		describe 'when Project.update produces an error', ->
			beforeEach ->
				@Project.update = sinon.stub().callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@TokenAccessHandler.addReadOnlyUserToProject @userId, @projectId, (err) =>
					expect(err).to.exist
					done()


	describe 'addReadAndWriteUserToProject', ->
		beforeEach ->
			@Project.update = sinon.stub().callsArgWith(2, null)

		it 'should call Project.update', (done) ->
			@TokenAccessHandler.addReadAndWriteUserToProject @userId, @projectId, (err) =>
				expect(@Project.update.callCount).to.equal 1
				expect(@Project.update.calledWith({
					_id: @projectId
				})).to.equal true
				expect(@Project.update.lastCall.args[1]['$addToSet'])
					.to.have.keys 'tokenAccessReadAndWrite_refs'
				done()

		it 'should not produce an error', (done) ->
			@TokenAccessHandler.addReadAndWriteUserToProject @userId, @projectId, (err) =>
				expect(err).to.not.exist
				done()

		describe 'when Project.update produces an error', ->
			beforeEach ->
				@Project.update = sinon.stub().callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@TokenAccessHandler.addReadAndWriteUserToProject @userId, @projectId, (err) =>
					expect(err).to.exist
					done()


	describe 'grantSessionTokenAccess', ->
		beforeEach ->
			@req = {session: {}, headers: {}}

		it 'should add the token to the session', (done) ->
			@TokenAccessHandler.grantSessionTokenAccess(@req, @projectId, @token)
			expect(@req.session.anonTokenAccess[@projectId.toString()])
				.to.equal @token
			done()







	describe 'isValidToken', ->

		describe 'when a read-only project is found', ->

			beforeEach ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, null)
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, null, @project)

			it 'should try to find projects with both kinds of token', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					done()

			it 'should allow read-only access', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, rw, ro) =>
					expect(err).to.not.exist
					expect(rw).to.equal false
					expect(ro).to.equal true
					done()

		describe 'when a read-and-write project is found', ->

			beforeEach ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, @project)
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, null, null)

			it 'should try to find projects with both kinds of token', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					done()

			it 'should allow read-and-write access', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, rw, ro) =>
					expect(err).to.not.exist
					expect(rw).to.equal true
					expect(ro).to.equal false
					done()

		describe 'when no project is found', ->
			beforeEach ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, null)
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, null, null)

			it 'should try to find projects with both kinds of token', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					done()

			it 'should not allow any access', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, rw, ro) =>
					expect(err).to.not.exist
					expect(rw).to.equal false
					expect(ro).to.equal false
					done()

		describe 'when findProject produces an error', ->
			beforeEach ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, null)
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, new Error('woops'))

			it 'should try to find projects with both kinds of token', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
						.to.equal 1
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					done()

			it 'should produce an error and not allow access', (done) ->
				@TokenAccessHandler.isValidToken @projectId, @token, (err, rw, ro) =>
					expect(err).to.exist
					expect(err).to.be.instanceof Error
					expect(rw).to.equal undefined
					expect(ro).to.equal undefined
					done()

		describe 'when project is not set to token-based access', ->
			beforeEach ->
				@project.publicAccesLevel = 'private'

			describe 'for read-and-write project', ->
				beforeEach ->
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, @project)
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, null)

				it 'should try to find projects with both kinds of token', (done) ->
					@TokenAccessHandler.isValidToken @projectId, @token, (err, allowed) =>
						expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
							.to.equal 1
						expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
							.to.equal 1
						done()

				it 'should not allow any access', (done) ->
					@TokenAccessHandler.isValidToken @projectId, @token, (err, rw, ro) =>
						expect(err).to.not.exist
						expect(rw).to.equal false
						expect(ro).to.equal false
						done()

			describe 'for read-only project', ->
				beforeEach ->
					@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
						.callsArgWith(1, null, null)
					@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
						.callsArgWith(1, null, @project)

				it 'should try to find projects with both kinds of token', (done) ->
					@TokenAccessHandler.isValidToken @projectId, @token, (err, allowed) =>
						expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
							.to.equal 1
						expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
							.to.equal 1
						done()

				it 'should not allow any access', (done) ->
					@TokenAccessHandler.isValidToken @projectId, @token, (err, rw, ro) =>
						expect(err).to.not.exist
						expect(rw).to.equal false
						expect(ro).to.equal false
						done()

		describe 'with nothing', ->
			beforeEach ->
				@TokenAccessHandler.findProjectWithReadAndWriteToken = sinon.stub()
					.callsArgWith(1, null, @project)
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, null, null)

			it 'should not call findProjectWithReadOnlyToken', (done) ->
				@TokenAccessHandler.isValidToken @projectId, null, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 0
					done()

			it 'should try to find projects with both kinds of token', (done) ->
				@TokenAccessHandler.isValidToken @projectId, null, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadAndWriteToken.callCount)
						.to.equal 0
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 0
					done()

			it 'should not allow any access', (done) ->
				@TokenAccessHandler.isValidToken @projectId, null, (err, rw, ro) =>
					expect(err).to.not.exist
					expect(rw).to.equal false
					expect(ro).to.equal false
					done()

	describe 'protectTokens', ->
		beforeEach ->
			@project = {tokens: {readAndWrite: 'rw', readOnly: 'ro', readAndWritePrefix: 'pre'}}

		it 'should hide write token from read-only user', ->
			@TokenAccessHandler.protectTokens(@project, 'readOnly')
			expect(@project.tokens.readAndWrite).to.equal ''
			expect(@project.tokens.readAndWritePrefix).to.equal ''
			expect(@project.tokens.readOnly).to.equal 'ro'

		it 'should hide read token from read-write user', ->
			@TokenAccessHandler.protectTokens(@project, 'readAndWrite')
			expect(@project.tokens.readAndWrite).to.equal 'rw'
			expect(@project.tokens.readOnly).to.equal ''

		it 'should leave tokens in place for owner', ->
			@TokenAccessHandler.protectTokens(@project, 'owner')
			expect(@project.tokens.readAndWrite).to.equal 'rw'
			expect(@project.tokens.readOnly).to.equal 'ro'

	describe 'getDocPublishedInfo', ->
		beforeEach ->
			@callback = sinon.stub()

		describe 'when v1 api not set', ->
			beforeEach ->
				@TokenAccessHandler.getV1DocPublishedInfo @token, @callback

			it 'should not check access and return default info', ->
				expect(@V1Api.request.called).to.equal false
				expect(@callback.calledWith null, {
					allow: true
				}).to.equal true

		describe 'when v1 api is set', ->
			beforeEach ->
				@settings.apis = { v1: 'v1' }

			describe 'on V1Api.request success', ->
				beforeEach ->
					@V1Api.request = sinon.stub().callsArgWith(1, null, null, 'mock-data')
					@TokenAccessHandler.getV1DocPublishedInfo @token, @callback

				it 'should return response body', ->
					expect(@V1Api.request.calledWith { url: "/api/v1/sharelatex/docs/#{@token}/is_published" }).to.equal true
					expect(@callback.calledWith null, 'mock-data').to.equal true

			describe 'on V1Api.request error', ->
				beforeEach ->
					@V1Api.request = sinon.stub().callsArgWith(1, 'error')
					@TokenAccessHandler.getV1DocPublishedInfo @token, @callback

				it 'should callback with error', ->
					expect(@callback.calledWith 'error').to.equal true

	describe 'getV1DocInfo', ->
		beforeEach ->
			@v2UserId = 123
			@callback = sinon.stub()

		describe 'when v1 api not set', ->
			beforeEach ->
				@TokenAccessHandler.getV1DocInfo @token, @v2UserId, @callback

			it 'should not check access and return default info', ->
				expect(@V1Api.request.called).to.equal false
				expect(@callback.calledWith null, {
					exists: true
					exported: false
				}).to.equal true

		describe 'when v1 api is set', ->
			beforeEach ->
				@settings.apis = { v1: 'v1' }

			describe 'on UserGetter.getUser success', ->
				beforeEach ->
					@UserGetter.getUser = sinon.stub().yields(null, {
						overleaf: { id: 1 }
					})
					@TokenAccessHandler.getV1DocInfo @token, @v2UserId, @callback
				
				it 'should get user', ->
					expect(@UserGetter.getUser.calledWith(@v2UserId)).to.equal true

			describe 'on UserGetter.getUser error', ->
				beforeEach ->
					@error = new Error('failed to get user')
					@UserGetter.getUser = sinon.stub().yields(@error)
					@TokenAccessHandler.getV1DocInfo @token, @v2UserId, @callback

				it 'should callback with error', ->
					expect(@callback.calledWith @error).to.equal true

			describe 'on V1Api.request success', ->
				beforeEach ->
					@v1UserId = 1
					@UserGetter.getUser = sinon.stub().yields(null, {
						overleaf: { id: @v1UserId }
					})
					@V1Api.request = sinon.stub().callsArgWith(1, null, null, 'mock-data')
					@TokenAccessHandler.getV1DocInfo @token, @v2UserId, @callback

				it 'should return response body', ->
					expect(@V1Api.request.calledWith { url: "/api/v1/sharelatex/users/#{@v1UserId}/docs/#{@token}/info" }).to.equal true
					expect(@callback.calledWith null, 'mock-data').to.equal true

			describe 'on V1Api.request error', ->
				beforeEach ->
					@UserGetter.getUser = sinon.stub().yields(null, {
						overleaf: { id: 1 }
					})
					@V1Api.request = sinon.stub().callsArgWith(1, 'error')
					@TokenAccessHandler.getV1DocInfo @token, @v2UserId, @callback

				it 'should callback with error', ->
					expect(@callback.calledWith 'error').to.equal true
