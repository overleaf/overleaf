sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Collaborators/CollaboratorsInviteHandler.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
ObjectId = require("mongojs").ObjectId

describe "CollaboratorsInviteHandler", ->
	beforeEach ->
		@ProjectInvite = class ProjectInvite
			constructor: (options={}) ->
				this._id = ObjectId()
				for k,v of options
					this[k] = v
				this
			save: sinon.stub()
			findOne: sinon.stub()
		@Project = {}
		@CollaboratorsInviteHandler = SandboxedModule.require modulePath, requires:
			'settings-sharelatex': @settings = {}
			'logger-sharelatex': @logger = {err: sinon.stub(), error: sinon.stub(), log: sinon.stub()}
			'./CollaboratorsEmailHandler': @CollaboratorsEmailHandler = {}
			'../Contacts/ContactManager': @ContactManager = {}
			'../../models/Project': {Project: @Project}
			'../../models/ProjectInvite': {ProjectInvite: @ProjectInvite}

		@projectId = ObjectId()
		@sendingUserId = ObjectId()
		@email = "user@example.com"
		@userId = ObjectId()
		@privileges = "readAndWrite"

	describe 'inviteToProject', ->

		beforeEach ->
			@ProjectInvite::save = sinon.spy (cb) -> cb(null, this)
			@CollaboratorsEmailHandler.notifyUserOfProjectInvite = sinon.stub()
			@call = (callback) =>
				@CollaboratorsInviteHandler.inviteToProject @projectId, @sendingUserId, @email, @privileges, callback

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

			it 'should have called ProjectInvite.save', (done) ->
				@call (err, invite) =>
					@ProjectInvite::save.callCount.should.equal 1
					done()

			it 'should have called CollaboratorsEmailHandler.notifyUserOfProjectInvite', (done) ->
				@call (err, invite) =>
					@CollaboratorsEmailHandler.notifyUserOfProjectInvite.callCount.should.equal 1
					@CollaboratorsEmailHandler.notifyUserOfProjectInvite.calledWith(@projectId, @email).should.equal true
					done()
