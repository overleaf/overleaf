should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/Features/BetaProgram/BetaProgramHandler'
sinon = require("sinon")
expect = require("chai").expect


describe 'BetaProgramHandler', ->

	beforeEach ->
		@user_id = "some_id"
		@user =
			_id: @user_id
			email: 'user@example.com'
			features: {}
			betaProgram: false
			save: sinon.stub().callsArgWith(0, null)
		@handler = SandboxedModule.require modulePath, requires:
			"../../models/User": {
				User:
					findById: sinon.stub().callsArgWith(1, null, @user)
			},
			"logger-sharelatex": @logger = {
				log: sinon.stub()
				err: sinon.stub()
			},
			"../../infrastructure/Metrics": @logger = {
				inc: sinon.stub()
			}


	describe "optIn", ->

		beforeEach ->
			@user.betaProgram = false
			@call = (callback) =>
				@handler.optIn @user_id, callback

		it "should set betaProgram = true on user object", (done) ->
			@call (err) =>
				@user.betaProgram.should.equal true
				done()

		it "should call user.save", (done) ->
			@call (err) =>
				@user.save.callCount.should.equal 1
				done()

		it "should not produce an error", (done) ->
			@call (err) =>
				expect(err).to.equal null
				expect(err).to.not.be.instanceof Error
				done()

		describe "when user.save produces an error", ->

			beforeEach ->
				@user.save.callsArgWith(0, new Error('woops'))

			it "should produce an error", (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

	describe "optOut", ->

		beforeEach ->
			@user.betaProgram = true
			@call = (callback) =>
				@handler.optOut @user_id, callback

		it "should set betaProgram = true on user object", (done) ->
			@call (err) =>
				@user.betaProgram.should.equal false
				done()

		it "should call user.save", (done) ->
			@call (err) =>
				@user.save.callCount.should.equal 1
				done()

		it "should not produce an error", (done) ->
			@call (err) =>
				expect(err).to.equal null
				expect(err).to.not.be.instanceof Error
				done()

		describe "when user.save produces an error", ->

			beforeEach ->
				@user.save.callsArgWith(0, new Error('woops'))

			it "should produce an error", (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()
