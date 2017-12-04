SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
expect = require('chai').expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/SudoMode/SudoModeMiddlewear'


describe 'SudoModeMiddlewear', ->
	beforeEach ->
		@userId = 'some_user_id'
		@SudoModeHandler =
			isSudoModeActive: sinon.stub()
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@userId)
			_setRedirectInSession: sinon.stub()
		@SudoModeMiddlewear = SandboxedModule.require modulePath, requires:
			'./SudoModeHandler': @SudoModeHandler
			'../Authentication/AuthenticationController': @AuthenticationController
			'logger-sharelatex': {log: sinon.stub(), err: sinon.stub()}

	describe 'protectPage', ->
		beforeEach ->
			@externalAuth = false
			@call = (cb) =>
				@req = {externalAuthenticationSystemUsed: sinon.stub().returns(@externalAuth)}
				@res = {redirect: sinon.stub()}
				@next = sinon.stub()
				@SudoModeMiddlewear.protectPage @req, @res, @next
				cb()

		describe 'when sudo mode is active', ->
			beforeEach ->
				@AuthenticationController.getLoggedInUserId = sinon.stub().returns(@userId)
				@SudoModeHandler.isSudoModeActive = sinon.stub().callsArgWith(1, null, true)

			it 'should get the current user id', (done) ->
				@call () =>
					@AuthenticationController.getLoggedInUserId.callCount.should.equal 1
					done()

			it 'should check if sudo-mode is active', (done) ->
				@call () =>
					@SudoModeHandler.isSudoModeActive.callCount.should.equal 1
					@SudoModeHandler.isSudoModeActive.calledWith(@userId).should.equal true
					done()

			it 'should call next', (done) ->
				@call () =>
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.equal undefined
					done()

		describe 'when sudo mode is not active', ->
			beforeEach ->
				@AuthenticationController._setRedirectInSession = sinon.stub()
				@AuthenticationController.getLoggedInUserId = sinon.stub().returns(@userId)
				@SudoModeHandler.isSudoModeActive = sinon.stub().callsArgWith(1, null, false)

			it 'should get the current user id', (done) ->
				@call () =>
					@AuthenticationController.getLoggedInUserId.callCount.should.equal 1
					done()

			it 'should check if sudo-mode is active', (done) ->
				@call () =>
					@SudoModeHandler.isSudoModeActive.callCount.should.equal 1
					@SudoModeHandler.isSudoModeActive.calledWith(@userId).should.equal true
					done()

			it 'should set redirect in session', (done) ->
				@call () =>
					@AuthenticationController._setRedirectInSession.callCount.should.equal 1
					@AuthenticationController._setRedirectInSession.calledWith(@req).should.equal true
					done()

			it 'should redirect to the password-prompt page', (done) ->
				@call () =>
					@res.redirect.callCount.should.equal 1
					@res.redirect.calledWith('/confirm-password').should.equal true
					done()

		describe 'when isSudoModeActive produces an error', ->
			beforeEach ->
				@AuthenticationController.getLoggedInUserId = sinon.stub().returns(@userId)
				@SudoModeHandler.isSudoModeActive = sinon.stub().callsArgWith(1, new Error('woops'))

			it 'should get the current user id', (done) ->
				@call () =>
					@AuthenticationController.getLoggedInUserId.callCount.should.equal 1
					done()

			it 'should check if sudo-mode is active', (done) ->
				@call () =>
					@SudoModeHandler.isSudoModeActive.callCount.should.equal 1
					@SudoModeHandler.isSudoModeActive.calledWith(@userId).should.equal true
					done()

			it 'should call next with an error', (done) ->
				@call () =>
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.be.instanceof Error
					done()

		describe 'when external auth is being used', ->
			beforeEach ->
				@externalAuth = true

			it 'should immediately return next with no args', (done) ->
				@call () =>
					@next.callCount.should.equal 1
					expect(@next.lastCall.args[0]).to.not.exist
					done()

			it 'should not get the current user id', (done) ->
				@call () =>
					@AuthenticationController.getLoggedInUserId.callCount.should.equal 0
					done()

			it 'should not check if sudo-mode is active', (done) ->
				@call () =>
					@SudoModeHandler.isSudoModeActive.callCount.should.equal 0
					done()
