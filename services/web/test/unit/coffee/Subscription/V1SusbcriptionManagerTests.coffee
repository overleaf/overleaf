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
			"settings-sharelatex": @Settings =
				apis:
					v1:
						host: @host = "http://overleaf.example.com"
				v1GrandfatheredFeaturesUidCutoff: 10
				v1GrandfatheredFeatures:
					github: true
					mendeley: true
			"request": @request = sinon.stub()
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
			@V1SubscriptionManager._v1Request = sinon.stub()
				.yields(null, @responseBody)
			@call = (cb) =>
				@V1SubscriptionManager.getPlanCodeFromV1 @userId, cb

		describe 'when all goes well', ->
			it 'should call _v1Request', (done) ->
				@call (err, planCode) =>
					expect(
						@V1SubscriptionManager._v1Request.callCount
					).to.equal 1
					expect(
						@V1SubscriptionManager._v1Request.calledWith(
							@userId
						)
					).to.equal true
					done()

			it 'should return the v1 user id', (done) ->
				@call (err, planCode, v1Id) ->
					expect(v1Id).to.equal @v1UserId
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

	describe 'getGrandfatheredFeaturesForV1User', ->
		describe 'when the user ID is greater than the cutoff', ->
			it 'should return an empty feature set', (done) ->
				expect(@V1SubscriptionManager.getGrandfatheredFeaturesForV1User 100).to.eql {}
				done()

		describe 'when the user ID is less than the cutoff', ->
			it 'should return a feature set with grandfathered properties for github and mendeley', (done) ->
				expect(@V1SubscriptionManager.getGrandfatheredFeaturesForV1User 1).to.eql
					github: true
					mendeley: true
				done()

	describe '_v1Request', ->
		beforeEach ->
			@UserGetter.getUser = sinon.stub()
				.yields(null, @user)

		describe 'when v1IdForUser produces an error', ->
			beforeEach ->
				@V1SubscriptionManager.v1IdForUser = sinon.stub()
					.yields(new Error('woops'))
				@call = (cb) =>
					@V1SubscriptionManager._v1Request @user_id, { url: () -> '/foo' }, cb

			it 'should not call request', (done) ->
				@call (err, planCode) =>
					expect(
						@request.callCount
					).to.equal 0
					done()

			it 'should produce an error', (done) ->
				@call (err, planCode) =>
					expect(err).to.exist
					done()

		describe 'when v1IdForUser does not find a user', ->
			beforeEach ->
				@V1SubscriptionManager.v1IdForUser = sinon.stub()
					.yields(null, null)
				@call = (cb) =>
					@V1SubscriptionManager._v1Request @user_id, { url: () -> '/foo' }, cb

			it 'should not call request', (done) ->
				@call (err, planCode) =>
					expect(
						@request.callCount
					).to.equal 0
					done()

			it 'should not error', (done) ->
				@call (err) =>
					expect(err).to.not.exist
					done()

		describe 'when the request to v1 fails', ->
			beforeEach ->
				@request.yields(new Error('woops'))
				@call = (cb) =>
					@V1SubscriptionManager._v1Request @user_id, { url: () -> '/foo' }, cb

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.exist
					done()

		describe 'when the call succeeds', ->
			beforeEach ->
				@V1SubscriptionManager.v1IdForUser = sinon.stub()
					.yields(null, @v1UserId)
				@request.yields(null, { statusCode: 200 }, "{}")
				@call = (cb) =>
					@V1SubscriptionManager._v1Request @user_id, { url: () -> '/foo' }, cb

			it 'should not produce an error', (done) ->
				@call (err, body, v1Id) =>
					expect(err).not.to.exist
					done()

			it 'should return the v1 user id', (done) ->
				@call (err, body, v1Id) =>
					expect(v1Id).to.equal @v1UserId
					done()

			it 'should return the http response body', (done) ->
				@call (err, body, v1Id) =>
					expect(body).to.equal "{}"
					done()

		describe 'when the call returns an http error status code', ->
			beforeEach ->
				@V1SubscriptionManager.v1IdForUser = sinon.stub()
					.yields(null, @v1UserId)
				@request.yields(null, { statusCode: 500 }, "{}")
				@call = (cb) =>
					@V1SubscriptionManager._v1Request @user_id, { url: () -> '/foo' }, cb

			it 'should produce an error', (done) ->
				@call (err, body, v1Id) =>
					expect(err).to.exist
					done()

	describe 'v1IdForUser', ->
		beforeEach ->
			@UserGetter.getUser = sinon.stub()
				.yields(null, @user)

		describe 'when getUser produces an error', ->
			beforeEach ->
				@UserGetter.getUser = sinon.stub()
					.yields(new Error('woops'))
				@call = (cb) =>
					@V1SubscriptionManager.v1IdForUser @user_id, cb

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.exist
					done()

		describe 'when getUser does not find a user', ->
			beforeEach ->
				@UserGetter.getUser = sinon.stub()
					.yields(null, null)
				@call = (cb) =>
					@V1SubscriptionManager.v1IdForUser @user_id, cb

			it 'should not error', (done) ->
				@call (err, user_id) =>
					expect(err).to.not.exist
					done()

		describe 'when it works', ->
			beforeEach ->
				@call = (cb) =>
					@V1SubscriptionManager.v1IdForUser @user_id, cb

			it 'should not error', (done) ->
				@call (err, user_id) =>
					expect(err).to.not.exist
					done()

			it 'should return the v1 user id', (done) ->
				@call (err, user_id) =>
					expect(user_id).to.eql 42
					done()