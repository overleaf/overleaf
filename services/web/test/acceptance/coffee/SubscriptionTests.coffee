expect = require('chai').expect
async = require("async")
User = require "./helpers/User"
{Subscription} = require "../../../app/js/models/Subscription"
{Institution} = require "../../../app/js/models/Institution"
SubscriptionViewModelBuilder = require "../../../app/js/Features/Subscription/SubscriptionViewModelBuilder"

MockRecurlyApi = require "./helpers/MockRecurlyApi"
MockV1Api = require "./helpers/MockV1Api"

describe 'Subscriptions', ->
	describe 'dashboard', ->
		before (done) ->
			@user = new User()
			@user.ensureUserExists done

		describe 'when the user has no subscription', ->
			before (done) ->
				SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
					return done(error) if error?
					done()

			it 'should return no personalSubscription', ->
				expect(@data.personalSubscription).to.equal null

			it 'should return no memberGroupSubscriptions', ->
				expect(@data.memberGroupSubscriptions).to.deep.equal []

			it 'should return no v1Subscriptions', ->
				expect(@data.v1Subscriptions).to.deep.equal {}

		describe 'when the user has a subscription with recurly', ->
			before (done) ->
				MockRecurlyApi.accounts['mock-account-id'] = @accounts = {
					hosted_login_token: 'mock-login-token'
				}
				MockRecurlyApi.subscriptions['mock-subscription-id'] = @subscription = {
					plan_code: 'collaborator',
					tax_in_cents: 100,
					tax_rate: 0.2,
					unit_amount_in_cents: 500,
					currency: 'GBP',
					current_period_ends_at: new Date(2018,4,5),
					state: 'active',
					account_id: 'mock-account-id',
					trial_ends_at: new Date(2018, 6, 7)
				}
				Subscription.create {
					admin_id: @user._id,
					manager_ids: [@user._id],
					recurlySubscription_id: 'mock-subscription-id',
					planCode: 'collaborator'
				}, (error) =>
					return done(error) if error?
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
						return done(error) if error?
						done()
				return

			after (done) ->
				MockRecurlyApi.accounts = {}
				MockRecurlyApi.subscriptions = {}
				Subscription.remove {
					admin_id: @user._id
				}, done
				return

			it 'should return a personalSubscription with populated recurly data', ->
				subscription = @data.personalSubscription
				expect(subscription).to.exist
				expect(subscription.planCode).to.equal 'collaborator'
				expect(subscription.recurly).to.exist
				expect(subscription.recurly).to.deep.equal {
					"billingDetailsLink": "https://test.recurly.com/account/billing_info/edit?ht=mock-login-token"
					"currency": "GBP"
					"nextPaymentDueAt": "5th May 2018"
					"price": "£6.00"
					"state": "active"
					"tax": 100
					"taxRate": 0.2
					"trial_ends_at": new Date(2018, 6, 7),
					"trialEndsAtFormatted": "7th July 2018"
				}

			it 'should return no memberGroupSubscriptions', ->
				expect(@data.memberGroupSubscriptions).to.deep.equal []

		describe 'when the user has a subscription without recurly', ->
			before (done) ->
				Subscription.create {
					admin_id: @user._id,
					manager_ids: [@user._id],
					planCode: 'collaborator'
				}, (error) =>
					return done(error) if error?
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
						return done(error) if error?
						done()
				return

			after (done) ->
				Subscription.remove {
					admin_id: @user._id
				}, done
				return

			it 'should return a personalSubscription with no recurly data', ->
				subscription = @data.personalSubscription
				expect(subscription).to.exist
				expect(subscription.planCode).to.equal 'collaborator'
				expect(subscription.recurly).to.not.exist

			it 'should return no memberGroupSubscriptions', ->
				expect(@data.memberGroupSubscriptions).to.deep.equal []

		describe 'when the user is a member of a group subscription', ->
			before (done) ->
				@owner1 = new User()
				@owner2 = new User()
				async.series [
					(cb) => @owner1.ensureUserExists cb
					(cb) => @owner2.ensureUserExists cb
					(cb) => Subscription.create {
							admin_id: @owner1._id,
							manager_ids: [@owner1._id],
							planCode: 'collaborator',
							groupPlan: true,
							member_ids: [@user._id]
						}, cb
					(cb) => Subscription.create {
							admin_id: @owner2._id,
							manager_ids: [@owner2._id],
							planCode: 'collaborator',
							groupPlan: true,
							member_ids: [@user._id]
						}, cb
				], (error) =>				
					return done(error) if error?
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
						return done(error) if error?
						done()
				return

			after (done) ->
				Subscription.remove {
					admin_id: @owner1._id
				}, (error) =>
					return done(error) if error?
					Subscription.remove {
						admin_id: @owner2._id
					}, done
				return

			it 'should return no personalSubscription', ->
				expect(@data.personalSubscription).to.equal null

			it 'should return the two memberGroupSubscriptions', ->
				expect(@data.memberGroupSubscriptions.length).to.equal 2
				expect(
					# Mongoose populates the admin_id with the user
					@data.memberGroupSubscriptions[0].admin_id._id.toString()
				).to.equal @owner1._id
				expect(
					@data.memberGroupSubscriptions[1].admin_id._id.toString()
				).to.equal @owner2._id

		describe 'when the user is a manager of a group subscription', ->
			before (done) ->
				@owner1 = new User()
				@owner2 = new User()
				async.series [
					(cb) => @owner1.ensureUserExists cb
					(cb) => @owner2.ensureUserExists cb
					(cb) => Subscription.create {
							admin_id: @owner1._id,
							manager_ids: [@owner1._id, @user._id],
							planCode: 'collaborator',
							groupPlan: true
						}, cb
				], (error) =>				
					return done(error) if error?
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
						return done(error) if error?
						done()
				return

			after (done) ->
				Subscription.remove {
					admin_id: @owner1._id
				}, done
				return

			it 'should return no personalSubscription', ->
				expect(@data.personalSubscription).to.equal null

			it 'should return the managedGroupSubscriptions', ->
				expect(@data.managedGroupSubscriptions.length).to.equal 1
				subscription = @data.managedGroupSubscriptions[0]
				expect(
					# Mongoose populates the admin_id with the user
					subscription.admin_id._id.toString()
				).to.equal @owner1._id
				expect(subscription.groupPlan).to.equal true

		describe 'when the user is a manager of an institution', ->
			before (done) ->
				@v1Id = MockV1Api.nextV1Id()
				async.series [
					(cb) =>
						Institution.create({
							v1Id: @v1Id,
							managerIds: [@user._id]
						}, cb)
				], (error) =>
					return done(error) if error?
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
						return done(error) if error?
						done()
				return

			after (done) ->
				Institution.remove {
					v1Id: @v1Id
				}, done
				return

			it 'should return the managedInstitutions', ->
				expect(@data.managedInstitutions.length).to.equal 1
				institution = @data.managedInstitutions[0]
				expect(institution.v1Id).to.equal @v1Id
				expect(institution.name).to.equal "Institution #{@v1Id}"

		describe 'when the user is a member of an affiliation', ->
			before (done) ->
				v1Id = MockV1Api.nextV1Id()
				MockV1Api.setUser v1Id, {
					subscription: {},
					subscription_status: {}
				}
				MockV1Api.setAffiliations [{
					email: 'confirmed-affiliation-email@stanford.example.edu'
					institution: { name: 'Stanford', licence: 'pro_plus', confirmed: true }
				}, {
					email: 'unconfirmed-affiliation-email@harvard.example.edu'
					institution: { name: 'Harvard', licence: 'pro_plus', confirmed: true }
				}, {
					email: 'confirmed-affiliation-email@mit.example.edu'
					institution: { name: 'MIT', licence: 'pro_plus', confirmed: false }
				}]
				async.series [
					(cb) =>
						@user.setV1Id v1Id, cb
					(cb) =>
						@user.addEmail 'unconfirmed-affiliation-email@harvard.example.edu', cb
					(cb) =>
						@user.addEmail 'confirmed-affiliation-email@stanford.example.edu', cb
					(cb) =>
						@user.confirmEmail 'confirmed-affiliation-email@stanford.example.edu', cb
					(cb) =>
						@user.addEmail 'confirmed-affiliation-email@mit.example.edu', cb
					(cb) =>
						@user.confirmEmail 'confirmed-affiliation-email@mit.example.edu', cb
				], (error) =>
					return done(error) if error?
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
						return done(error) if error?
						done()

			it 'should return only the affilations with confirmed institutions, and confirmed emails', ->
				expect(@data.confirmedMemberInstitutions).to.deep.equal [
					{ name: 'Stanford', licence: 'pro_plus', confirmed: true }
				]

		describe 'when the user has a v1 subscription', ->
			before (done) ->
				MockV1Api.setUser v1Id = MockV1Api.nextV1Id(), {
					subscription: @subscription = {
						trial: false,
						has_plan: true,
						teams: [{
							id: 56,
							name: 'Test team'
						}]
					}
					subscription_status: @subscription_status = {
						product: { 'mock': 'product' }
						team: null
					}
				}
				@user.setV1Id v1Id, (error) =>
					return done(error) if error?
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel @user, (error, @data) =>
						return done(error) if error?
						done()

			it 'should return no personalSubscription', ->
				expect(@data.personalSubscription).to.equal null

			it 'should return no memberGroupSubscriptions', ->
				expect(@data.memberGroupSubscriptions).to.deep.equal []

			it 'should return a v1Subscriptions', ->
				expect(@data.v1Subscriptions).to.deep.equal @subscription

			it 'should return a v1SubscriptionStatus', ->
				expect(@data.v1SubscriptionStatus).to.deep.equal @subscription_status

	describe 'canceling', ->
		before (done) ->
			@user = new User()
			MockV1Api.setUser v1Id = MockV1Api.nextV1Id(), @v1_user = {}
			async.series [
				(cb) => @user.login(cb)
				(cb) => @user.setV1Id(v1Id, cb)
			], (error) =>
				@user.request {
					method: 'POST',
					url: '/user/subscription/v1/cancel'
				}, (error, @response) =>
					return done(error) if error?
					done()

		it 'should tell v1 to cancel the subscription', ->
			expect(@v1_user.canceled).to.equal true

		it 'should redirect to the subscription dashboard', ->
			expect(@response.statusCode).to.equal 302
			expect(@response.headers.location).to.equal '/user/subscription'
