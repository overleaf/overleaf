should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/Features/Subscription/V1SubscriptionManager'
sinon = require("sinon")
expect = require("chai").expect


describe 'V1SubscriptionManager', ->
	beforeEach ->
		@V1SubscriptionManager = SandboxedModule.require modulePath, requires:
			"../User/UserGetter": @UserGetter = {}
			"logger-sharelatex":
				log: sinon.stub()
				err: sinon.stub()
				warn: sinon.stub()
			"settings-sharelatex":
				overleaf:
					host: @host = "http://overleaf.example.com"
			"request": @request = sinon.stub()
		@V1SubscriptionManager._v1PlanRequest = sinon.stub()
		@userId = 'abcd'
		@v1UserId = 42
		@user =
			_id: @userId
			email: 'user@example.com'
			overleaf:
				id: @v1UserId

	describe 'getPlanCodeFromV1', ->
		beforeEach ->
			@responseBody =
				id: 32,
				plan_name: 'pro'
			@UserGetter.getUser = sinon.stub()
				.yields(null, @user)
			@V1SubscriptionManager._v1PlanRequest = sinon.stub()
				.yields(null, @responseBody)
			@call = (cb) =>
				@V1SubscriptionManager.getPlanCodeFromV1 @userId, cb

		describe 'when all goes well', ->

			it 'should call getUser', (done) ->
				@call (err, planCode) =>
					expect(
						@UserGetter.getUser.callCount
					).to.equal 1
					expect(
						@UserGetter.getUser.calledWith(@userId)
					).to.equal true
					done()

			it 'should call _v1PlanRequest', (done) ->
				@call (err, planCode) =>
					expect(
						@V1SubscriptionManager._v1PlanRequest.callCount
					).to.equal 1
					expect(
						@V1SubscriptionManager._v1PlanRequest.calledWith(
							@v1UserId
						)
					).to.equal true
					done()

			it 'should produce a plan-code without error', (done) ->
				@call (err, planCode) =>
					expect(err).to.not.exist
					expect(planCode).to.equal 'v1_pro'
					done()

			describe 'when the plan_name from v1 is null', ->
				beforeEach ->
					@responseBody.plan_name = null

				it 'should produce a null plan-code without error', (done) ->
					@call (err, planCode) =>
						expect(err).to.not.exist
						expect(planCode).to.equal null
						done()

		describe 'when getUser produces an error', ->
			beforeEach ->
				@UserGetter.getUser = sinon.stub()
					.yields(new Error('woops'))

			it 'should not call _v1PlanRequest', (done) ->
				@call (err, planCode) =>
					expect(
						@V1SubscriptionManager._v1PlanRequest.callCount
					).to.equal 0
					done()

			it 'should produce an error', (done) ->
				@call (err, planCode) =>
					expect(err).to.exist
					expect(planCode).to.not.exist
					done()

		describe 'when getUser does not find a user', ->
			beforeEach ->
				@UserGetter.getUser = sinon.stub()
					.yields(null, null)

			it 'should not call _v1PlanRequest', (done) ->
				@call (err, planCode) =>
					expect(
						@V1SubscriptionManager._v1PlanRequest.callCount
					).to.equal 0
					done()

			it 'should produce a null plan-code, without error', (done) ->
				@call (err, planCode) =>
					expect(err).to.not.exist
					expect(planCode).to.not.exist
					done()

		describe 'when the request to v1 fails', ->
			beforeEach ->
				@V1SubscriptionManager._v1PlanRequest = sinon.stub()
					.yields(new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, planCode) =>
					expect(err).to.exist
					expect(planCode).to.not.exist
					done()
