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
			_getRediretFromSession: sinon.stub()
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
			@req = {externalAuthenticationSystemUsed: sinon.stub().returns(false)}
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

			it 'should not render page', ->
				@SudoModeController.sudoModePrompt(@req, @res, @next)
				@res.render.callCount.should.equal 0

		describe 'when external auth system is used', ->
			beforeEach ->
				@req.externalAuthenticationSystemUsed = sinon.stub().returns(true)

			it 'should redirect', ->
				@SudoModeController.sudoModePrompt(@req, @res, @next)
				@res.redirect.callCount.should.equal 1
				@res.redirect.calledWith('/project').should.equal true

			it 'should not check if sudo mode is active', ->
				@SudoModeController.sudoModePrompt(@req, @res, @next)
				@SudoModeHandler.isSudoModeActive.callCount.should.equal 0

			it 'should not render page', ->
				@SudoModeController.sudoModePrompt(@req, @res, @next)
				@res.render.callCount.should.equal 0

	describe 'submitPassword', ->
		beforeEach ->
			@AuthenticationController._getRedirectFromSession = sinon.stub().returns '/somewhere'
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @user)
			@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, @user)
			@SudoModeHandler.activateSudoMode = sinon.stub().callsArgWith(1, null)
			@password = 'a_terrible_secret'
			@req = {body: {password: @password}}
			@res = {json: sinon.stub()}
			@next = sinon.stub()

		describe 'when all goes well', ->
			beforeEach ->

			it 'should get the logged in user id', ->
				@SudoModeController.submitPassword(@req, @res, @next)
				@AuthenticationController.getLoggedInUserId.callCount.should.equal 1
				@AuthenticationController.getLoggedInUserId.calledWith(@req).should.equal true

			it 'should get redirect from session', ->
				@SudoModeController.submitPassword(@req, @res, @next)
				@AuthenticationController._getRedirectFromSession.callCount.should.equal 1
				@AuthenticationController._getRedirectFromSession.calledWith(@req).should.equal true

			it 'should get the user from storage', ->
				@SudoModeController.submitPassword(@req, @res, @next)
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith('some_object_id', {email: 1}).should.equal true

			it 'should try to authenticate the user with the password', ->
				@SudoModeController.submitPassword(@req, @res, @next)
				@AuthenticationManager.authenticate.callCount.should.equal 1
				@AuthenticationManager.authenticate.calledWith({email: @user.email}, @password).should.equal true

			it 'should activate sudo mode', ->
				@SudoModeController.submitPassword(@req, @res, @next)
				@SudoModeHandler.activateSudoMode.callCount.should.equal 1
				@SudoModeHandler.activateSudoMode.calledWith(@user._id).should.equal true

			it 'should send back a json response', ->
				@SudoModeController.submitPassword(@req, @res, @next)
				@res.json.callCount.should.equal 1
				@res.json.calledWith({redir: '/somewhere'}).should.equal true

			it 'should not call next', ->
				@SudoModeController.submitPassword(@req, @res, @next)
				@next.callCount.should.equal 0

			describe 'when no password is supplied', ->
				beforeEach ->
					@req.body.password = ''
					@next = sinon.stub()

				it 'should return next with an error', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error

				it 'should not get the user from storage', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@UserGetter.getUser.callCount.should.equal 0

				it 'should not try to authenticate the user with the password', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@AuthenticationManager.authenticate.callCount.should.equal 0

				it 'should not activate sudo mode', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@SudoModeHandler.activateSudoMode.callCount.should.equal 0

				it 'should not send back a json response', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@res.json.callCount.should.equal 0

			describe 'when getUser produces an error', ->
				beforeEach ->
					@UserGetter.getUser = sinon.stub().callsArgWith(2, new Error('woops'))
					@next = sinon.stub()

				it 'should return next with an error', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error

				it 'should get the user from storage', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith('some_object_id', {email: 1}).should.equal true

				it 'should not try to authenticate the user with the password', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@AuthenticationManager.authenticate.callCount.should.equal 0

				it 'should not activate sudo mode', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@SudoModeHandler.activateSudoMode.callCount.should.equal 0

				it 'should not send back a json response', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@res.json.callCount.should.equal 0

			describe 'when getUser does not find a user', ->
				beforeEach ->
					@UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
					@next = sinon.stub()

				it 'should return next with an error', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error

				it 'should get the user from storage', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith('some_object_id', {email: 1}).should.equal true

				it 'should not try to authenticate the user with the password', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@AuthenticationManager.authenticate.callCount.should.equal 0

				it 'should not activate sudo mode', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@SudoModeHandler.activateSudoMode.callCount.should.equal 0

				it 'should not send back a json response', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@res.json.callCount.should.equal 0

			describe 'when authentication fails', ->
				beforeEach ->
					@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, null)
					@res.json = sinon.stub()
					@req.i18n = {translate: sinon.stub()}

				it 'should send back a failure message', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@res.json.callCount.should.equal 1
					expect(@res.json.lastCall.args[0]).to.have.keys ['message']
					expect(@res.json.lastCall.args[0].message).to.have.keys ['text', 'type']
					@req.i18n.translate.callCount.should.equal 1
					@req.i18n.translate.calledWith('invalid_password')

				it 'should get the user from storage', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith('some_object_id', {email: 1}).should.equal true

				it 'should try to authenticate the user with the password', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@AuthenticationManager.authenticate.callCount.should.equal 1
					@AuthenticationManager.authenticate.calledWith({email: @user.email}, @password).should.equal true

				it 'should not activate sudo mode', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@SudoModeHandler.activateSudoMode.callCount.should.equal 0

			describe 'when authentication produces an error', ->
				beforeEach ->
					@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, new Error('woops'))
					@next = sinon.stub()

				it 'should return next with an error', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error

				it 'should get the user from storage', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith('some_object_id', {email: 1}).should.equal true

				it 'should try to authenticate the user with the password', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@AuthenticationManager.authenticate.callCount.should.equal 1
					@AuthenticationManager.authenticate.calledWith({email: @user.email}, @password).should.equal true

				it 'should not activate sudo mode', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@SudoModeHandler.activateSudoMode.callCount.should.equal 0

			describe 'when sudo mode activation produces an error', ->
				beforeEach ->
					@SudoModeHandler.activateSudoMode = sinon.stub().callsArgWith(1, new Error('woops'))
					@next = sinon.stub()

				it 'should return next with an error', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error

				it 'should get the user from storage', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith('some_object_id', {email: 1}).should.equal true

				it 'should try to authenticate the user with the password', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@AuthenticationManager.authenticate.callCount.should.equal 1
					@AuthenticationManager.authenticate.calledWith({email: @user.email}, @password).should.equal true

				it 'should have tried to activate sudo mode', ->
					@SudoModeController.submitPassword(@req, @res, @next)
					@SudoModeHandler.activateSudoMode.callCount.should.equal 1
					@SudoModeHandler.activateSudoMode.calledWith(@user._id).should.equal true
