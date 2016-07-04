sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/User/UserSessionsManager.js"
SandboxedModule = require('sandboxed-module')

describe 'UserSessionsManager', ->

	beforeEach ->
		@user =
			_id: "abcd"
			email: "user@example.com"
		@sessionId = 'some_session_id'
		@rclient =
			multi: () => @rclient
			exec:     sinon.stub()
			get:      sinon.stub().returns(@rclient)
			sadd:     sinon.stub().returns(@rclient)
			srem:     sinon.stub().returns(@rclient)
			smembers: sinon.stub().returns(@rclient)
			expire:   sinon.stub().returns(@rclient)
		@redis =
			createClient: () -> @rclient
		@logger =
			err:   sinon.stub()
			error: sinon.stub()
			log:   sinon.stub()
		@settings =
			redis:
				web: {}
		@UserSessionsManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex":    @redis
			"logger-sharelatex":   @logger
			"settings-sharelatex": @settings

	describe '_sessionSetKey', ->

		it 'should build the correct key', ->
			result = @UserSessionsManager._sessionSetKey(@user)
			result.should.equal 'UserSessions:abcd'

	describe '_sessionKey', ->

		it 'should build the correct key', ->
			result = @UserSessionsManager._sessionKey(@sessionId)
			result.should.equal 'sess:some_session_id'
