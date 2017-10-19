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
			'settings-sharelatex': {}


	describe 'findProjectWithReadOnlyToken', ->
		beforeEach ->
			@Project.findOne = sinon.stub().callsArgWith(2, null, @project)

		it 'should call Project.findOne', (done) ->
			@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project) =>
				expect(@Project.findOne.callCount).to.equal 1
				expect(@Project.findOne.calledWith({
					'tokens.readOnly': @token,
					'publicAccesLevel': 'tokenBased'
				})).to.equal true
				done()

		it 'should produce a project object with no error', (done) ->
			@TokenAccessHandler.findProjectWithReadOnlyToken @token, (err, project) =>
				expect(err).to.not.exist
				expect(project).to.exist
				expect(project).to.deep.equal @project
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

	describe 'findProjectWithReadAndWriteToken', ->
		beforeEach ->
			@Project.findOne = sinon.stub().callsArgWith(2, null, @project)

		it 'should call Project.findOne', (done) ->
			@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project) =>
				expect(@Project.findOne.callCount).to.equal 1
				expect(@Project.findOne.calledWith({
					'tokens.readAndWrite': @token,
					'publicAccesLevel': 'tokenBased'
				})).to.equal true
				done()

		it 'should produce a project object with no error', (done) ->
			@TokenAccessHandler.findProjectWithReadAndWriteToken @token, (err, project) =>
				expect(err).to.not.exist
				expect(project).to.exist
				expect(project).to.deep.equal @project
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


	describe 'findPrivateOverleafProjectWithReadAndWriteToken', ->
		beforeEach ->
			@Project.findOne = sinon.stub().callsArgWith(2, null, @project)

		it 'should call Project.findOne', (done) ->
			@TokenAccessHandler.findPrivateOverleafProjectWithReadAndWriteToken @token, (err, project) =>
				expect(@Project.findOne.callCount).to.equal 1
				expect(@Project.findOne.calledWith({
					'tokens.readAndWrite': @token,
					'publicAccesLevel': 'private',
					'overleaf.id': {$exists: true}
				})).to.equal true
				done()

		it 'should produce a project object with no error', (done) ->
			@TokenAccessHandler.findPrivateOverleafProjectWithReadAndWriteToken @token, (err, project) =>
				expect(err).to.not.exist
				expect(project).to.exist
				expect(project).to.deep.equal @project
				done()

		describe 'when Project.findOne produces an error', ->
			beforeEach ->
				@Project.findOne = sinon.stub().callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@TokenAccessHandler.findPrivateOverleafProjectWithReadAndWriteToken @token, (err, project) =>
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
			@project = {tokens: {readAndWrite: 'rw', readOnly: 'ro'}}

		it 'should hide write token from read-only user', ->
			@TokenAccessHandler.protectTokens(@project, 'readOnly')
			expect(@project.tokens.readAndWrite).to.equal ''
			expect(@project.tokens.readOnly).to.equal 'ro'

		it 'should hide read token from read-write user', ->
			@TokenAccessHandler.protectTokens(@project, 'readAndWrite')
			expect(@project.tokens.readAndWrite).to.equal 'rw'
			expect(@project.tokens.readOnly).to.equal ''

		it 'should leave tokens in place for owner', ->
			@TokenAccessHandler.protectTokens(@project, 'owner')
			expect(@project.tokens.readAndWrite).to.equal 'rw'
			expect(@project.tokens.readOnly).to.equal 'ro'
