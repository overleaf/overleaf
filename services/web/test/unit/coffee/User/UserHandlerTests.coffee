sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/User/UserHandler.js"
SandboxedModule = require('sandboxed-module')

describe "UserHandler", ->

	beforeEach ->
		@user =
			_id:"12390i"
			email: "bob@bob.com"
			remove: sinon.stub().callsArgWith(0)

		@TeamInvitesHandler =
			createTeamInvitesForLegacyInvitedEmail: sinon.stub().yields()

		@UserHandler = SandboxedModule.require modulePath, requires:
			"../Subscription/TeamInvitesHandler": @TeamInvitesHandler

	describe "populateTeamInvites", ->
		beforeEach (done)->
			@UserHandler.populateTeamInvites @user, done

		it "notifies the user about legacy team invites", ->
			@TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail
				.calledWith(@user.email).should.eq true

