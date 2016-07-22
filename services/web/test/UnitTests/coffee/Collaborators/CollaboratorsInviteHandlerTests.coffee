sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Collaborators/CollaboratorsInviteHandler.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
ObjectId = require("mongojs").ObjectId
Crypto = require('crypto')

describe "CollaboratorsInviteHandler", ->
	beforeEach ->
		@ProjectInvite = class ProjectInvite
			constructor: (options={}) ->
				this._id = ObjectId()
				for k,v of options
					this[k] = v
				this
			save: sinon.stub()
			@findOne: sinon.stub()
			@remove: sinon.stub()
		@Project = {}
		@Crypto = Crypto
		@CollaboratorsInviteHandler = SandboxedModule.require modulePath, requires:
			'settings-sharelatex': @settings = {}
			'logger-sharelatex': @logger = {err: sinon.stub(), error: sinon.stub(), log: sinon.stub()}
			'./CollaboratorsEmailHandler': @CollaboratorsEmailHandler = {}
			'../Contacts/ContactManager': @ContactManager = {}
			'../../models/Project': {Project: @Project}
			'../../models/ProjectInvite': {ProjectInvite: @ProjectInvite}
			'crypto': @Crypto

		@projectId = ObjectId()
		@sendingUserId = ObjectId()
		@email = "user@example.com"
		@userId = ObjectId()
		@inviteId = ObjectId()
		@privileges = "readAndWrite"

	describe 'inviteToProject', ->

		beforeEach ->
			@ProjectInvite::save = sinon.spy (cb) -> cb(null, this)
			@randomBytesSpy = sinon.spy(@Crypto, 'randomBytes')
			@CollaboratorsEmailHandler.notifyUserOfProjectInvite = sinon.stub()
			@call = (callback) =>
				@CollaboratorsInviteHandler.inviteToProject @projectId, @sendingUserId, @email, @privileges, callback

		afterEach ->
			@randomBytesSpy.restore()

		describe 'when all goes well', ->

			beforeEach ->

			it 'should not produce an error', (done) ->
				@call (err, invite) =>
					expect(err).to.not.be.instanceof Error
					done()

			it 'should produce the invite object', (done) ->
				@call (err, invite) =>
					expect(invite).to.not.equal null
					expect(invite).to.not.equal undefined
					expect(invite).to.be.instanceof Object
					expect(invite).to.have.all.keys ['_id', 'email', 'token', 'sendingUserId', 'projectId', 'privileges']
					done()

			it 'should have generated a random token', (done) ->
				@call (err, invite) =>
					@randomBytesSpy.callCount.should.equal 1
					done()

			it 'should have called ProjectInvite.save', (done) ->
				@call (err, invite) =>
					@ProjectInvite::save.callCount.should.equal 1
					done()

			it 'should have called CollaboratorsEmailHandler.notifyUserOfProjectInvite', (done) ->
				@call (err, invite) =>
					@CollaboratorsEmailHandler.notifyUserOfProjectInvite.callCount.should.equal 1
					@CollaboratorsEmailHandler.notifyUserOfProjectInvite.calledWith(@projectId, @email).should.equal true
					done()

		describe 'when saving model produces an error', ->

			beforeEach ->
				@ProjectInvite::save = sinon.spy (cb) -> cb(new Error('woops'), this)

			it 'should produce an error', (done) ->
				@call (err, invite) =>
					expect(err).to.be.instanceof Error
					done()

	describe 'revokeInvite', ->

		beforeEach ->
			@ProjectInvite.remove.callsArgWith(1, null)
			@CollaboratorsEmailHandler.notifyUserOfProjectInvite = sinon.stub()
			@call = (callback) =>
				@CollaboratorsInviteHandler.revokeInvite @projectId, @inviteId, callback

		describe 'when all goes well', ->

			beforeEach ->

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					done()

			it 'should call ProjectInvite.remove', (done) ->
				@call (err) =>
					@ProjectInvite.remove.callCount.should.equal 1
					@ProjectInvite.remove.calledWith({projectId: @projectId, _id: @inviteId}).should.equal true
					done()

		describe 'when remove produces an error', ->

			beforeEach ->
				@ProjectInvite.remove.callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()
