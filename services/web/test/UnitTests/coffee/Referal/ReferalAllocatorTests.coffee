SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Referal/ReferalAllocator.js'

describe 'Referal allocator', ->

	beforeEach ->
		@ReferalAllocator = SandboxedModule.require modulePath, requires:
			'../../models/User': User: @User = {}
			"../Analytics/AnalyticsManager": @AnalyticsManager = {}
			"../Subscription/SubscriptionLocator": @SubscriptionLocator = {}
			"settings-sharelatex": @Settings = {}
			'logger-sharelatex':
				log:->
				err:->
		@callback = sinon.stub()
		@referal_id = "referal-id-123"
		@referal_medium = "twitter"
		@user_id = "user-id-123"
		@new_user_id = "new-user-id-123"

	describe "allocate", ->
		describe "when the referal was a bonus referal", ->
			beforeEach ->
				@referal_source = "bonus"
				@User.update = sinon.stub().callsArgWith 3, null
				@User.findOne = sinon.stub().callsArgWith 1, null, { _id: @user_id }
				@AnalyticsManager.trackReferral = sinon.stub()
				@ReferalAllocator.assignBonus = sinon.stub().callsArg 1
				@ReferalAllocator.allocate @referal_id, @new_user_id, @referal_source, @referal_medium, @callback

			it 'should update the referring user with the refered users id', ->
				@User.update.calledWith({
					"referal_id":@referal_id
				}, {
					$push:
						refered_users: @new_user_id
					$inc:
						refered_user_count: 1
				}).should.equal true

			it "find the referring users id", ->
				@User.findOne
					.calledWith( referal_id: @referal_id )
					.should.equal true
			
			it "should track the referral", ->
				@AnalyticsManager.trackReferral
					.calledWith({ _id: @user_id }, @referal_source, @referal_medium)
					.should.equal true

			it "shoudl assign the user their bonus", ->
				@ReferalAllocator.assignBonus
					.calledWith(@user_id)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the referal is not a bonus referal", ->
			beforeEach ->
				@referal_source = "public_share"
				@User.update = sinon.stub().callsArgWith 3, null
				@User.findOne = sinon.stub().callsArgWith 1, null, { _id: @user_id }
				@AnalyticsManager.trackReferral = sinon.stub()
				@ReferalAllocator.assignBonus = sinon.stub().callsArg 1
				@ReferalAllocator.allocate @referal_id, @new_user_id, @referal_source, @referal_medium, @callback

			it 'should not update the referring user with the refered users id', ->
				@User.update.called.should.equal false

			it "find the referring users id", ->
				@User.findOne
					.calledWith( referal_id: @referal_id )
					.should.equal true
			
			it "should track the referral", ->
				@AnalyticsManager.trackReferral
					.calledWith({ _id: @user_id }, @referal_source, @referal_medium)
					.should.equal true

			it "should not assign the user a bonus", ->
				@ReferalAllocator.assignBonus.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "assignBonus", ->
		describe "when user does not have a subscription", ->
			beforeEach ->
				@refered_user_count = 3
				@Settings.bonus_features =
					"3":
						collaborators: 3
						dropbox: false
						versioning: false
				@User.findOne = sinon.stub().callsArgWith 1, null, { refered_user_count: @refered_user_count }
				@User.update = sinon.stub().callsArgWith 2, null
				@SubscriptionLocator.getUsersSubscription = sinon.stub().callsArgWith 1, null, null
				@ReferalAllocator.assignBonus @user_id, @callback

			it "should get the users subscription", ->
				@SubscriptionLocator.getUsersSubscription
					.calledWith(@user_id)
					.should.equal true

			it "should get the users number of refered user", ->
				@User.findOne
					.calledWith(_id: @user_id)
					.should.equal true

			it "should update the user to bonus features", ->
				@User.update
					.calledWith({
						_id: @user_id
					}, {
						$set:
							features:
								@Settings.bonus_features[@refered_user_count.toString()]
					})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true
		
		describe "when user does not have a recurlySubscription_id", ->
			beforeEach ->
				@refered_user_count = 3
				@Settings.bonus_features =
					"3":
						collaborators: 3
						dropbox: false
						versioning: false
				@User.findOne = sinon.stub().callsArgWith 1, null, { refered_user_count: @refered_user_count }
				@User.update = sinon.stub().callsArgWith 2, null
				@SubscriptionLocator.getUsersSubscription = sinon.stub().callsArgWith 1, null, {}
				@ReferalAllocator.assignBonus @user_id, @callback

			it "should get the users subscription", ->
				@SubscriptionLocator.getUsersSubscription
					.calledWith(@user_id)
					.should.equal true

			it "should get the users number of refered user", ->
				@User.findOne
					.calledWith(_id: @user_id)
					.should.equal true

			it "should update the user to bonus features", ->
				@User.update
					.calledWith({
						_id: @user_id
					}, {
						$set:
							features:
								@Settings.bonus_features[@refered_user_count.toString()]
					})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the user is not at a bonus level", ->
			beforeEach ->
				@refered_user_count = 3
				@Settings.bonus_features =
					"4":
						collaborators: 3
						dropbox: false
						versioning: false
				@User.findOne = sinon.stub().callsArgWith 1, null, { refered_user_count: @refered_user_count }
				@User.update = sinon.stub().callsArgWith 2, null
				@SubscriptionLocator.getUsersSubscription = sinon.stub().callsArgWith 1, null, {}
				@ReferalAllocator.assignBonus @user_id, @callback

			it "should get the users subscription", ->
				@SubscriptionLocator.getUsersSubscription
					.calledWith(@user_id)
					.should.equal true

			it "should get the users number of refered user", ->
				@User.findOne
					.calledWith(_id: @user_id)
					.should.equal true

			it "should not update the user to bonus features", ->
				@User.update.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when user has a subscription", ->
			beforeEach ->
				@refered_user_count = 3
				@Settings.bonus_features =
					"3":
						collaborators: 3
						dropbox: false
						versioning: false
				@User.findOne = sinon.stub().callsArgWith 1, null, { refered_user_count: @refered_user_count }
				@User.update = sinon.stub().callsArgWith 2, null
				@SubscriptionLocator.getUsersSubscription = sinon.stub().callsArgWith 1, null, { planCode: "collaborator" }
				@ReferalAllocator.assignBonus @user_id, @callback

			it "should get the users subscription", ->
				@SubscriptionLocator.getUsersSubscription
					.calledWith(@user_id)
					.should.equal true

			it "should not get the users number of refered user", ->
				@User.findOne.called.should.equal false

			it "should not update the user to bonus features", ->
				@User.update.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true
