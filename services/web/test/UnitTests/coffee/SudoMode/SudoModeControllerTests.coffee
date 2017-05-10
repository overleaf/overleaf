SandboxedModule = require('sandboxed-module')
sinon = require 'sinon'
should = require("chai").should()
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

	# describe '', ->
	# 	beforeEach ->
