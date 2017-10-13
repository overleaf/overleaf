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


	describe 'grantSessionReadOnlyTokenAccess', ->
		beforeEach ->
			@req = {session: {}, headers: {}}

		it 'should add the token to the session', (done) ->
			@TokenAccessHandler.grantSessionReadOnlyTokenAccess(@req, @projectId, @token)
			expect(@req.session.anonReadOnlyTokenAccess[@projectId.toString()])
				.to.equal @token
			done()


	describe 'isValidReadOnlyToken', ->
		beforeEach ->
			@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
				.callsArgWith(1, null, @project)

		it 'should call findProjectWithReadOnlyToken', (done) ->
			@TokenAccessHandler.isValidReadOnlyToken @projectId, @token, (err, allowed) =>
				expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
					.to.equal 1
				done()

		it 'should allow access', (done) ->
			@TokenAccessHandler.isValidReadOnlyToken @projectId, @token, (err, allowed) =>
				expect(err).to.not.exist
				expect(allowed).to.equal true
				done()

		describe 'when no project is found', ->
			beforeEach ->
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, null, null)

			it 'should call findProjectWithReadOnlyToken', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @projectId, @token, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					done()

			it 'should not allow access', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @req, @projectId, (err, allowed) =>
					expect(err).to.not.exist
					expect(allowed).to.equal false
					done()

		describe 'when no findProject produces an error', ->
			beforeEach ->
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, new Error('woops'))

			it 'should call findProjectWithReadOnlyToken', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @projectId, @token, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					done()

			it 'should produce an error and not allow access', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @projectId, @token, (err, allowed) =>
					expect(err).to.exist
					expect(err).to.be.instanceof Error
					expect(allowed).to.equal undefined
					done()

		describe 'when project is not set to token-based access', ->
			beforeEach ->
				@project.publicAccesLevel = 'private'
				@TokenAccessHandler.findProjectWithReadOnlyToken = sinon.stub()
					.callsArgWith(1, null, @project)

			it 'should call findProjectWithReadOnlyToken', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @projectId, @token, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 1
					done()

			it 'should not allow access', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @projectId, @token, (err, allowed) =>
					expect(err).to.not.exist
					expect(allowed).to.equal false
					done()

		describe 'with nothing', ->
			beforeEach ->

			it 'should not call findProjectWithReadOnlyToken', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @projectId, null, (err, allowed) =>
					expect(@TokenAccessHandler.findProjectWithReadOnlyToken.callCount)
						.to.equal 0
					done()

			it 'should not allow access', (done) ->
				@TokenAccessHandler.isValidReadOnlyToken @req, @projectId, (err, allowed) =>
					expect(err).to.not.exist
					expect(allowed).to.equal false
					done()
