SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
expect = require("chai").expect
querystring = require 'querystring'
modulePath = "../../../../app/js/Features/Subscription/TeamInvitesHandler"

ObjectId = require("mongojs").ObjectId

describe "TeamInvitesHandler", ->
	beforeEach ->
		@manager = {
			id: "666666",
			first_name: "Daenerys"
			last_name: "Targaryen"
			email: "daenerys@motherofdragons.com"
		}

		@token = "aaaaaaaaaaaaaaaaaaaaaa"

		@teamInvite = {
			email: "jorah@mormont.org",
			token: @token,
		}

		@subscription = {
			id: "55153a8014829a865bbf700d",
			admin_id: @manager.id,
			groupPlan: true,
			member_ids: [],
			teamInvites: [ @teamInvite ],
			save: sinon.stub().yields(null),
		}

		@SubscriptionLocator = {
			getUsersSubscription: sinon.stub(),
			getSubscription: sinon.stub().yields(null, @subscription)
		}

		@UserGetter = {
			getUser: sinon.stub().yields(),
			getUserByAnyEmail: sinon.stub().yields()
		}

		@SubscriptionUpdater = {
			addUserToGroup: sinon.stub().yields()
		}

		@LimitationsManager = {
			teamHasReachedMemberLimit: sinon.stub().returns(false)
		}

		@Subscription = {
			findOne: sinon.stub().yields()
			update: sinon.stub().yields()
		}

		@EmailHandler = {
			sendEmail: sinon.stub().yields(null)
		}

		@newToken = "bbbbbbbbb"

		@crypto = {
			randomBytes: =>
				toString: sinon.stub().returns(@newToken)
		}

		@UserGetter.getUser.withArgs(@manager.id).yields(null, @manager)
		@UserGetter.getUserByAnyEmail.withArgs(@manager.email).yields(null, @manager)

		@SubscriptionLocator.getUsersSubscription.yields(null, @subscription)
		@Subscription.findOne.yields(null, @subscription)

		@TeamInvitesHandler = SandboxedModule.require modulePath, requires:
				"logger-sharelatex": { log: -> }
				"crypto": @crypto
				"settings-sharelatex": { siteUrl: "http://example.com" }
				"../../models/TeamInvite": { TeamInvite: @TeamInvite = {} }
				"../../models/Subscription": { Subscription: @Subscription }
				"../User/UserGetter": @UserGetter
				"./SubscriptionLocator": @SubscriptionLocator
				"./SubscriptionUpdater": @SubscriptionUpdater
				"./LimitationsManager": @LimitationsManager
				"../Email/EmailHandler": @EmailHandler

	describe "getInvite", ->
		it "returns the invite if there's one", (done) ->
			@TeamInvitesHandler.getInvite @token, (err, invite, subscription) =>
				expect(err).to.eq(null)
				expect(invite).to.deep.eq(@teamInvite)
				expect(subscription).to.deep.eq(@subscription)
				done()

		it "returns teamNotFound if there's none", (done) ->
			@Subscription.findOne = sinon.stub().yields(null, null)

			@TeamInvitesHandler.getInvite @token, (err, invite, subscription) ->
				expect(err).to.deep.eq(teamNotFound: true)
				done()

	describe "createInvite", ->
		it "adds the team invite to the subscription", (done) ->
			@TeamInvitesHandler.createInvite @manager.id, "John.Snow@nightwatch.com", (err, invite) =>
				expect(err).to.eq(null)
				expect(invite.token).to.eq(@newToken)
				expect(invite.email).to.eq("john.snow@nightwatch.com")
				expect(invite.inviterName).to.eq("Daenerys Targaryen (daenerys@motherofdragons.com)")
				expect(@subscription.teamInvites).to.deep.include(invite)
				done()

		it "sends an email", (done) ->
			@TeamInvitesHandler.createInvite @manager.id, "John.Snow@nightwatch.com", (err, invite) =>
				@EmailHandler.sendEmail.calledWith("verifyEmailToJoinTeam",
					sinon.match({
						to: "john.snow@nightwatch.com",
						inviterName: "Daenerys Targaryen (daenerys@motherofdragons.com)",
						acceptInviteUrl: "http://example.com/subscription/invites/#{@newToken}/"
					})
				).should.equal true
				done()

		it "refreshes the existing invite if the email has already been invited", (done) ->
			originalInvite = Object.assign({}, @teamInvite)

			@TeamInvitesHandler.createInvite @manager.id, originalInvite.email, (err, invite) =>
				expect(err).to.eq(null)
				expect(invite).to.exist

				expect(@subscription.teamInvites.length).to.eq 1
				expect(@subscription.teamInvites).to.deep.include invite

				expect(invite.email).to.eq originalInvite.email

				@subscription.save.calledOnce.should.eq true

				done()

	describe "createDomainInvite", ->
		beforeEach ->
			@licence =
				subscription_id: @subscription.id
				name: "Team Daenerys"

			@user =
				email: "John.Snow@nightwatch.com"

		it "adds the team invite to the subscription", (done) ->
			@TeamInvitesHandler.createDomainInvite @user, @licence, (err, invite) =>
				expect(err).to.eq(null)
				expect(invite.token).to.eq(@newToken)
				expect(invite.email).to.eq("john.snow@nightwatch.com")
				expect(invite.inviterName).to.eq("Team Daenerys")
				expect(@subscription.teamInvites).to.deep.include(invite)
				done()

		it "sends an email", (done) ->
			@TeamInvitesHandler.createDomainInvite @user, @licence, (err, invite) =>
				@EmailHandler.sendEmail.calledWith("verifyEmailToJoinTeam",
					sinon.match({
						to: "john.snow@nightwatch.com"
						inviterName: "Team Daenerys"
						acceptInviteUrl: "http://example.com/subscription/invites/#{@newToken}/"
					})
				).should.equal true
				done()

	describe "acceptInvite", ->
		beforeEach ->
			@user = {
				id: "123456789",
				first_name: "Tyrion",
				last_name: "Lannister",
				email: "tyrion@lannister.com"
			}

			@UserGetter.getUserByAnyEmail.withArgs(@user.email).yields(null, @user)

			@subscription.teamInvites.push({
				email: "john.snow@nightwatch.com",
				token: "dddddddd",
				inviterName: "Daenerys Targaryen (daenerys@motherofdragons.com)"
			})

		it "adds the user to the team", (done) ->
			@TeamInvitesHandler.acceptInvite "dddddddd", @user.id, =>
				@SubscriptionUpdater.addUserToGroup.calledWith(@manager.id, @user.id).should.eq true
				done()

		it "removes the invite from the subscription", (done) ->
			@TeamInvitesHandler.acceptInvite "dddddddd", @user.id, =>
				@Subscription.update.calledWith(
					{ _id: new ObjectId("55153a8014829a865bbf700d") },
					{ '$pull': { teamInvites: { email: 'john.snow@nightwatch.com' } } }
				).should.eq true
				done()

	describe "revokeInvite", ->
		it "removes the team invite from the subscription", (done) ->
			@TeamInvitesHandler.revokeInvite @manager.id, "jorah@mormont.org", =>
				@Subscription.update.calledWith(
					{ _id: new ObjectId("55153a8014829a865bbf700d") },
					{ '$pull': { teamInvites: { email: "jorah@mormont.org" } } }
				).should.eq true

				@Subscription.update.calledWith(
					{ _id: new ObjectId("55153a8014829a865bbf700d") },
					{ '$pull': { invited_emails: "jorah@mormont.org" } }
				).should.eq true
				done()

	describe "createTeamInvitesForLegacyInvitedEmail", (done) ->
		beforeEach ->
			@subscription.invited_emails = ["eddard@stark.com", "robert@stark.com"]
			@TeamInvitesHandler.createInvite = sinon.stub().yields(null)
			@SubscriptionLocator.getGroupsWithEmailInvite = sinon.stub().yields(null, [@subscription])

		it "sends an invitation email to addresses in the legacy invited_emails field", (done) ->
			@TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail "eddard@stark.com", (err, invite) =>
				expect(err).not.to.exist

				@TeamInvitesHandler.createInvite.calledWith(
					@subscription.admin_id,
					"eddard@stark.com"
				).should.eq true

				@TeamInvitesHandler.createInvite.callCount.should.eq 1

				done()

	describe "validation", ->
		it "doesn't create an invite if the team limit has been reached", (done) ->
			@LimitationsManager.teamHasReachedMemberLimit = sinon.stub().returns(true)
			@TeamInvitesHandler.createInvite @manager.id, "John.Snow@nightwatch.com", (err, invite) =>
				expect(err).to.deep.equal(limitReached: true)
				done()

		it "doesn't create an invite if the subscription is not in a group plan", (done) ->
			@subscription.groupPlan = false
			@TeamInvitesHandler.createInvite @manager.id, "John.Snow@nightwatch.com", (err, invite) =>
				expect(err).to.deep.equal(wrongPlan: true)
				done()

		it "doesn't create an invite if the user is already part of the team", (done) ->
			member = {
				id: "1a2b",
				_id: "1a2b",
				email: "tyrion@lannister.com"
			}

			@subscription.member_ids = [member.id]
			@UserGetter.getUserByAnyEmail.withArgs(member.email).yields(null, member)

			@TeamInvitesHandler.createInvite @manager.id, "tyrion@lannister.com", (err, invite) =>
				expect(err).to.deep.equal(alreadyInTeam: true)
				expect(invite).not.to.exist
				done()
