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
			multi:    sinon.stub()
			exec:     sinon.stub()
			get:      sinon.stub()
			sadd:     sinon.stub()
			srem:     sinon.stub()
			smembers: sinon.stub()
			expire:   sinon.stub()
		@rclient.multi.returns(@rclient)
		@rclient.get.returns(@rclient)
		@rclient.sadd.returns(@rclient)
		@rclient.srem.returns(@rclient)
		@rclient.smembers.returns(@rclient)
		@rclient.expire.returns(@rclient)
		@rclient.exec.callsArgWith(0, null)

		@redis =
			createClient: () => @rclient
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

	describe 'trackSession', ->

		beforeEach ->
			@call = (callback) =>
				@UserSessionsManager.trackSession @user, @sessionId, callback
			@rclient.exec.callsArgWith(0, null)
			@_checkSessions = sinon.stub(@UserSessionsManager, '_checkSessions').returns(null)

		afterEach ->
			@_checkSessions.restore()

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.not.be.instanceof Error
				done()

		it 'should call the appropriate redis methods', (done) ->
			@call (err) =>
				@rclient.multi.callCount.should.equal 1
				@rclient.sadd.callCount.should.equal 1
				@rclient.expire.callCount.should.equal 1
				@rclient.exec.callCount.should.equal 1
				done()

		it 'should call _checkSessions', (done) ->
			@call (err) =>
				@_checkSessions.callCount.should.equal 1
				done()

		describe 'when rclient produces an error', ->

			beforeEach ->
				@rclient.exec.callsArgWith(0, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()

			it 'should not call _checkSessions', (done) ->
				@call (err) =>
					@_checkSessions.callCount.should.equal 0
					done()

		describe 'when no user is supplied', ->

			beforeEach ->
				@call = (callback) =>
					@UserSessionsManager.trackSession null, @sessionId, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not call the appropriate redis methods', (done) ->
				@call (err) =>
					@rclient.multi.callCount.should.equal 0
					@rclient.sadd.callCount.should.equal 0
					@rclient.expire.callCount.should.equal 0
					@rclient.exec.callCount.should.equal 0
					done()

			it 'should not call _checkSessions', (done) ->
				@call (err) =>
					@_checkSessions.callCount.should.equal 0
					done()

		describe 'when no sessionId is supplied', ->

			beforeEach ->
				@call = (callback) =>
					@UserSessionsManager.trackSession @user, null, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not call the appropriate redis methods', (done) ->
				@call (err) =>
					@rclient.multi.callCount.should.equal 0
					@rclient.sadd.callCount.should.equal 0
					@rclient.expire.callCount.should.equal 0
					@rclient.exec.callCount.should.equal 0
					done()

			it 'should not call _checkSessions', (done) ->
				@call (err) =>
					@_checkSessions.callCount.should.equal 0
					done()

	describe 'untrackSession', ->

		beforeEach ->
			@call = (callback) =>
				@UserSessionsManager.untrackSession @user, @sessionId, callback
			@rclient.exec.callsArgWith(0, null)
			@_checkSessions = sinon.stub(@UserSessionsManager, '_checkSessions').returns(null)

		afterEach ->
			@_checkSessions.restore()

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.not.be.instanceof Error
				done()

		it 'should call the appropriate redis methods', (done) ->
			@call (err) =>
				@rclient.multi.callCount.should.equal 1
				@rclient.srem.callCount.should.equal 1
				@rclient.expire.callCount.should.equal 1
				@rclient.exec.callCount.should.equal 1
				done()

		it 'should call _checkSessions', (done) ->
			@call (err) =>
				@_checkSessions.callCount.should.equal 1
				done()

		describe 'when rclient produces an error', ->

			beforeEach ->
				@rclient.exec.callsArgWith(0, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()

			it 'should not call _checkSessions', (done) ->
				@call (err) =>
					@_checkSessions.callCount.should.equal 0
					done()

		describe 'when no user is supplied', ->

			beforeEach ->
				@call = (callback) =>
					@UserSessionsManager.untrackSession null, @sessionId, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not call the appropriate redis methods', (done) ->
				@call (err) =>
					@rclient.multi.callCount.should.equal 0
					@rclient.srem.callCount.should.equal 0
					@rclient.expire.callCount.should.equal 0
					@rclient.exec.callCount.should.equal 0
					done()

			it 'should not call _checkSessions', (done) ->
				@call (err) =>
					@_checkSessions.callCount.should.equal 0
					done()

		describe 'when no sessionId is supplied', ->

			beforeEach ->
				@call = (callback) =>
					@UserSessionsManager.untrackSession @user, null, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not call the appropriate redis methods', (done) ->
				@call (err) =>
					@rclient.multi.callCount.should.equal 0
					@rclient.srem.callCount.should.equal 0
					@rclient.expire.callCount.should.equal 0
					@rclient.exec.callCount.should.equal 0
					done()

			it 'should not call _checkSessions', (done) ->
				@call (err) =>
					@_checkSessions.callCount.should.equal 0
					done()
