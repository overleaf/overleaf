should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/BetaProgram/BetaProgramController"
expect = require("chai").expect

describe "BetaProgramController", ->

	beforeEach ->
		@user =
			_id: @user_id = "a_simple_id"
			email: "user@example.com"
			features: {}
			betaProgram: false
		@req =
			query: {}
			session:
				user: @user
		@BetaProgramController = SandboxedModule.require modulePath, requires:
			"./BetaProgramHandler": @BetaProgramHandler = {
				optIn: sinon.stub()
				optOut: sinon.stub()
			},
			"../User/UserLocator": @UserLocator = {
				findById: sinon.stub()
			},
			"settings-sharelatex": @settings = {
				languages: {}
			}
			"logger-sharelatex": @logger = {
				log: sinon.stub()
				err: sinon.stub()
				error: sinon.stub()
			}
			'../Authentication/AuthenticationController': @AuthenticationController = {
				getLoggedInUserId: sinon.stub().returns(@user._id)
			}
		@res =
			send: sinon.stub()
			redirect: sinon.stub()
			render: sinon.stub()
		@next = sinon.stub()

	describe "optIn", ->

		beforeEach ->
			@BetaProgramHandler.optIn.callsArgWith(1, null)

		it "should redirect to '/beta/participate'", () ->
			@BetaProgramController.optIn @req, @res, @next
			@res.redirect.callCount.should.equal 1
			@res.redirect.firstCall.args[0].should.equal "/beta/participate"

		it "should not call next with an error", () ->
			@BetaProgramController.optIn @req, @res, @next
			@next.callCount.should.equal 0

		it "should not call next with an error", () ->
			@BetaProgramController.optIn @req, @res, @next
			@next.callCount.should.equal 0

		it "should call BetaProgramHandler.optIn", () ->
			@BetaProgramController.optIn @req, @res, @next
			@BetaProgramHandler.optIn.callCount.should.equal 1

		describe "when BetaProgramHandler.opIn produces an error", ->

			beforeEach ->
				@BetaProgramHandler.optIn.callsArgWith(1, new Error('woops'))

			it "should not redirect to '/beta/participate'", () ->
				@BetaProgramController.optIn @req, @res, @next
				@res.redirect.callCount.should.equal 0

			it "should produce an error", () ->
				@BetaProgramController.optIn @req, @res, @next
				@next.callCount.should.equal 1
				@next.firstCall.args[0].should.be.instanceof Error

	describe "optOut", ->

		beforeEach ->
			@BetaProgramHandler.optOut.callsArgWith(1, null)

		it "should redirect to '/beta/participate'", () ->
			@BetaProgramController.optOut @req, @res, @next
			@res.redirect.callCount.should.equal 1
			@res.redirect.firstCall.args[0].should.equal "/beta/participate"

		it "should not call next with an error", () ->
			@BetaProgramController.optOut @req, @res, @next
			@next.callCount.should.equal 0

		it "should not call next with an error", () ->
			@BetaProgramController.optOut @req, @res, @next
			@next.callCount.should.equal 0

		it "should call BetaProgramHandler.optOut", () ->
			@BetaProgramController.optOut @req, @res, @next
			@BetaProgramHandler.optOut.callCount.should.equal 1

		describe "when BetaProgramHandler.optOut produces an error", ->

			beforeEach ->
				@BetaProgramHandler.optOut.callsArgWith(1, new Error('woops'))

			it "should not redirect to '/beta/participate'", () ->
				@BetaProgramController.optOut @req, @res, @next
				@res.redirect.callCount.should.equal 0

			it "should produce an error", () ->
				@BetaProgramController.optOut @req, @res, @next
				@next.callCount.should.equal 1
				@next.firstCall.args[0].should.be.instanceof Error


	describe "optInPage", ->

		beforeEach ->
			@UserLocator.findById.callsArgWith(1, null, @user)

		it "should render the opt-in page", () ->
			@BetaProgramController.optInPage @req, @res, @next
			@res.render.callCount.should.equal 1
			args = @res.render.firstCall.args
			args[0].should.equal 'beta_program/opt_in'


		describe "when UserLocator.findById produces an error", ->

			beforeEach ->
				@UserLocator.findById.callsArgWith(1, new Error('woops'))

			it "should not render the opt-in page", () ->
				@BetaProgramController.optInPage @req, @res, @next
				@res.render.callCount.should.equal 0

			it "should produce an error", () ->
				@BetaProgramController.optInPage @req, @res, @next
				@next.callCount.should.equal 1
				@next.firstCall.args[0].should.be.instanceof Error
