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
			del:      sinon.stub()
			sadd:     sinon.stub()
			srem:     sinon.stub()
			smembers: sinon.stub()
			mget:     sinon.stub()
			expire:   sinon.stub()
		@rclient.multi.returns(@rclient)
		@rclient.get.returns(@rclient)
		@rclient.del.returns(@rclient)
		@rclient.sadd.returns(@rclient)
		@rclient.srem.returns(@rclient)
		@rclient.smembers.returns(@rclient)
		@rclient.expire.returns(@rclient)
		@rclient.exec.callsArgWith(0, null)

		@redis =
			client: () => @rclient
		@logger =
			err:   sinon.stub()
			error: sinon.stub()
			log:   sinon.stub()
		@settings =
			redis:
				web: {}
		@UserSessionsManager = SandboxedModule.require modulePath, requires:
			"logger-sharelatex":   @logger
			"settings-sharelatex": @settings
			'./UserSessionsRedis': @redis

	describe '_sessionSetKey', ->

		it 'should build the correct key', ->
			result = @UserSessionsManager._sessionSetKey(@user)
			result.should.equal 'UserSessions:{abcd}'

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
				expect(err).to.equal undefined
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

	##
	describe 'revokeAllUserSessions', ->

		beforeEach ->
			@sessionKeys = ['sess:one', 'sess:two']
			@retain = []
			@rclient.smembers.callsArgWith(1, null, @sessionKeys)
			@rclient.exec.callsArgWith(0, null)
			@call = (callback) =>
				@UserSessionsManager.revokeAllUserSessions @user, @retain, callback

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.not.be.instanceof Error
				expect(err).to.equal null
				done()

		it 'should call the appropriate redis methods', (done) ->
			@call (err) =>
				@rclient.smembers.callCount.should.equal 1
				@rclient.multi.callCount.should.equal 1

				@rclient.del.callCount.should.equal 1
				expect(@rclient.del.firstCall.args[0]).to.deep.equal @sessionKeys

				@rclient.srem.callCount.should.equal 1
				expect(@rclient.srem.firstCall.args[1]).to.deep.equal @sessionKeys

				@rclient.exec.callCount.should.equal 1
				done()

		describe 'when a session is retained', ->

			beforeEach ->
				@sessionKeys = ['sess:one', 'sess:two', 'sess:three', 'sess:four']
				@retain = ['two']
				@rclient.smembers.callsArgWith(1, null, @sessionKeys)
				@rclient.exec.callsArgWith(0, null)
				@call = (callback) =>
					@UserSessionsManager.revokeAllUserSessions @user, @retain, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should call the appropriate redis methods', (done) ->
				@call (err) =>
					@rclient.smembers.callCount.should.equal 1
					@rclient.multi.callCount.should.equal 1
					@rclient.del.callCount.should.equal 1
					@rclient.srem.callCount.should.equal 1
					@rclient.exec.callCount.should.equal 1
					done()

			it 'should remove all sessions except for the retained one', (done) ->
				@call (err) =>
					expect(@rclient.del.firstCall.args[0]).to.deep.equal(['sess:one', 'sess:three', 'sess:four'])
					expect(@rclient.srem.firstCall.args[1]).to.deep.equal(['sess:one', 'sess:three', 'sess:four'])
					done()

		describe 'when rclient produces an error', ->

			beforeEach ->
				@rclient.exec.callsArgWith(0, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()

		describe 'when no user is supplied', ->

			beforeEach ->
				@call = (callback) =>
					@UserSessionsManager.revokeAllUserSessions null, @retain, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not call the appropriate redis methods', (done) ->
				@call (err) =>
					@rclient.smembers.callCount.should.equal 0
					@rclient.multi.callCount.should.equal 0
					@rclient.del.callCount.should.equal 0
					@rclient.srem.callCount.should.equal 0
					@rclient.exec.callCount.should.equal 0
					done()

		describe 'when there are no keys to delete', ->

			beforeEach ->
				@rclient.smembers.callsArgWith(1, null, [])

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not do the delete operation', (done) ->
				@call (err) =>
					@rclient.smembers.callCount.should.equal 1
					@rclient.multi.callCount.should.equal 0
					@rclient.del.callCount.should.equal 0
					@rclient.srem.callCount.should.equal 0
					@rclient.exec.callCount.should.equal 0
					done()

	describe 'touch', ->

		beforeEach ->
			@rclient.expire.callsArgWith(2, null)
			@call = (callback) =>
				@UserSessionsManager.touch @user, callback

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.not.be.instanceof Error
				expect(err).to.equal null
				done()

		it 'should call rclient.expire', (done) ->
			@call (err) =>
				@rclient.expire.callCount.should.equal 1
				done()

		describe 'when rclient produces an error', ->

			beforeEach ->
				@rclient.expire.callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()

		describe 'when no user is supplied', ->

			beforeEach ->
				@call = (callback) =>
					@UserSessionsManager.touch null, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not call expire', (done) ->
				@call (err) =>
					@rclient.expire.callCount.should.equal 0
					done()

	describe 'getAllUserSessions', ->

		beforeEach ->
			@sessionKeys = ['sess:one', 'sess:two', 'sess:three']
			@sessions = [
				'{"user": {"ip_address": "a", "session_created": "b"}}',
				'{"passport": {"user": {"ip_address": "c", "session_created": "d"}}}'
			]
			@exclude = ['two']
			@rclient.smembers.callsArgWith(1, null, @sessionKeys)
			@rclient.mget.callsArgWith(1, null, @sessions)
			@call = (callback) =>
				@UserSessionsManager.getAllUserSessions @user, @exclude, callback

		it 'should not produce an error', (done) ->
			@call (err, sessions) =>
				expect(err).to.equal null
				done()

		it 'should get sessions', (done) ->
			@call (err, sessions) =>
				expect(sessions).to.deep.equal [
					{ ip_address: 'a', session_created: 'b' },
					{ ip_address: 'c', session_created: 'd' }
				]
				done()

		it 'should have called rclient.smembers', (done) ->
			@call (err, sessions) =>
				@rclient.smembers.callCount.should.equal 1
				done()

		it 'should have called rclient.mget', (done) ->
			@call (err, sessions) =>
				@rclient.mget.callCount.should.equal 1
				done()

		describe 'when there are no other sessions', ->

			beforeEach ->
				@sessionKeys = ['sess:two']
				@rclient.smembers.callsArgWith(1, null, @sessionKeys)

			it 'should not produce an error', (done) ->
				@call (err, sessions) =>
					expect(err).to.equal null
					done()

			it 'should produce an empty list of sessions', (done) ->
				@call (err, sessions) =>
					expect(sessions).to.deep.equal []
					done()

			it 'should have called rclient.smembers', (done) ->
				@call (err, sessions) =>
					@rclient.smembers.callCount.should.equal 1
					done()

			it 'should not have called rclient.mget', (done) ->
				@call (err, sessions) =>
					@rclient.mget.callCount.should.equal 0
					done()

		describe 'when smembers produces an error', ->

			beforeEach ->
				@rclient.smembers.callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, sessions) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

			it 'should not have called rclient.mget', (done) ->
				@call (err, sessions) =>
					@rclient.mget.callCount.should.equal 0
					done()

		describe 'when mget produces an error', ->

			beforeEach ->
				@rclient.mget.callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, sessions) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()


	describe '_checkSessions', ->

		beforeEach ->
			@call = (callback) =>
				@UserSessionsManager._checkSessions @user, callback
			@sessionKeys = ['one', 'two']
			@rclient.smembers.callsArgWith(1, null, @sessionKeys)
			@rclient.get.callsArgWith(1, null, 'some-value')
			@rclient.srem.callsArgWith(2, null, {})

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.not.be.instanceof Error
				expect(err).to.equal undefined
				done()

		it 'should call the appropriate redis methods', (done) ->
			@call (err) =>
				@rclient.smembers.callCount.should.equal 1
				@rclient.get.callCount.should.equal 2
				@rclient.srem.callCount.should.equal 0
				done()

		describe 'when one of the keys is not present in redis', ->

			beforeEach ->
				@rclient.get.onCall(0).callsArgWith(1, null, 'some-val')
				@rclient.get.onCall(1).callsArgWith(1, null, null)

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal undefined
					done()

			it 'should remove that key from the set', (done) ->
				@call (err) =>
					@rclient.smembers.callCount.should.equal 1
					@rclient.get.callCount.should.equal 2
					@rclient.srem.callCount.should.equal 1
					@rclient.srem.firstCall.args[1].should.equal 'two'
					done()

		describe 'when no user is supplied', ->

			beforeEach ->
				@call = (callback) =>
					@UserSessionsManager._checkSessions null, callback

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.instanceof Error
					expect(err).to.equal null
					done()

			it 'should not call redis methods', (done) ->
				@call (err) =>
					@rclient.smembers.callCount.should.equal 0
					@rclient.get.callCount.should.equal 0
					done()

		describe 'when one of the get operations produces an error', ->

			beforeEach ->
				@rclient.get.onCall(0).callsArgWith(1, new Error('woops'), null)
				@rclient.get.onCall(1).callsArgWith(1, null, null)

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()

			it 'should call the right redis methods, bailing out early', (done) ->
				@call (err) =>
					@rclient.smembers.callCount.should.equal 1
					@rclient.get.callCount.should.equal 1
					@rclient.srem.callCount.should.equal 0
					done()
