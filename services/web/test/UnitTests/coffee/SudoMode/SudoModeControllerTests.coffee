SandboxedModule = require('sandboxed-module')
sinon = require 'sinon'
should = require("chai").should()
expect = require('chai').expect
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
modulePath = '../../../../app/js/Features/SudoMode/SudoModeController'

describe 'SudoModeController', ->
	beforeEach ->
		@user =
			_id: 'abcd'
			email: 'user@example.com'
		@UserGetter =
			getUser: sinon.stub().callsArgWith(2, null, @user)
		@SudoModeHandler =
			isSudoModeActive: sinon.stub()
			activateSudoMode: sinon.stub()
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user._id)
		@AuthenticationManager =
			authenticate: sinon.stub()
		@UserGetter =
			getUser: sinon.stub()
		@SudoModeController = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': {log: sinon.stub(), err: sinon.stub()}
			'./SudoModeHandler': @SudoModeHandler
			'../Authentication/AuthenticationController': @AuthenticationController
			'../Authentication/AuthenticationManager': @AuthenticationManager
			'../../infrastructure/Mongoose': {mongo: {ObjectId: () -> 'some_object_id'}}
			'../User/UserGetter': @UserGetter

	describe 'sudoModePrompt', ->
		beforeEach ->
			@SudoModeHandler.isSudoModeActive = sinon.stub().callsArgWith(1, null, false)
			@req = {}
			@res = {redirect: sinon.stub(), render: sinon.stub()}
			@next = sinon.stub()

		it 'should get the logged in user id', ->
			@SudoModeController.sudoModePrompt(@req, @res, @next)
			@AuthenticationController.getLoggedInUserId.callCount.should.equal 1
			@AuthenticationController.getLoggedInUserId.calledWith(@req).should.equal true

		it 'should check if sudo-mode is active', ->
			@SudoModeController.sudoModePrompt(@req, @res, @next)
			@SudoModeHandler.isSudoModeActive.callCount.should.equal 1
			@SudoModeHandler.isSudoModeActive.calledWith(@user._id).should.equal true

		it 'should redirect when sudo-mode is active', ->
			@SudoModeHandler.isSudoModeActive = sinon.stub().callsArgWith(1, null, true)
			@SudoModeController.sudoModePrompt(@req, @res, @next)
			@res.redirect.callCount.should.equal 1
			@res.redirect.calledWith('/project').should.equal true

		it 'should render the sudo_mode_prompt page when sudo mode is not active', ->
			@SudoModeHandler.isSudoModeActive = sinon.stub().callsArgWith(1, null, false)
			@SudoModeController.sudoModePrompt(@req, @res, @next)
			@res.render.callCount.should.equal 1
			@res.render.calledWith('sudo_mode/sudo_mode_prompt').should.equal true

		describe 'when isSudoModeActive produces an error', ->
			beforeEach ->
				@SudoModeHandler.isSudoModeActive = sinon.stub().callsArgWith(1, new Error('woops'))
				@next = sinon.stub()

			it 'should call next with an error', ->
				@SudoModeController.sudoModePrompt(@req, @res, @next)
				@next.callCount.should.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error
