{EventEmitter} = require('events')
{expect} = require('chai')
SandboxedModule = require('sandboxed-module')
modulePath = '../../../app/js/SessionSockets'
sinon = require('sinon')

describe 'SessionSockets', ->
	before ->
		@SessionSocketsModule = SandboxedModule.require modulePath
		@io = new EventEmitter()
		@id1 = Math.random().toString()
		@id2 = Math.random().toString()
		redisResponses =
			error: [new Error('Redis: something went wrong'), null]
			unknownId: [null, null]
		redisResponses[@id1] = [null, {user: {_id: '123'}}]
		redisResponses[@id2] = [null, {user: {_id: 'abc'}}]

		@sessionStore =
			get: sinon.stub().callsFake (id, fn) ->
				fn.apply(null, redisResponses[id])
		@cookieParser = (req, res, next) ->
			req.signedCookies = req._signedCookies
			next()
		@SessionSockets = @SessionSocketsModule(@io, @sessionStore, @cookieParser, 'ol.sid')
		@checkSocket = (socket, fn) =>
			@SessionSockets.once('connection', fn)
			@io.emit('connection', socket)

	describe 'without cookies', ->
		before ->
			@socket = {handshake: {}}

		it 'should return a lookup error', (done) ->
			@checkSocket @socket, (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('could not look up session by key')
				done()

		it 'should not query redis', (done) ->
			@checkSocket @socket, () =>
				expect(@sessionStore.get.called).to.equal(false)
				done()

	describe 'with a different cookie', ->
		before ->
			@socket = {handshake: {_signedCookies: {other: 1}}}

		it 'should return a lookup error', (done) ->
			@checkSocket @socket, (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('could not look up session by key')
				done()

		it 'should not query redis', (done) ->
			@checkSocket @socket, () =>
				expect(@sessionStore.get.called).to.equal(false)
				done()

	describe 'with a valid cookie and a failing session lookup', ->
		before ->
			@socket = {handshake: {_signedCookies: {'ol.sid': 'error'}}}

		it 'should query redis', (done) ->
			@checkSocket @socket, () =>
				expect(@sessionStore.get.called).to.equal(true)
				done()

		it 'should return a redis error', (done) ->
			@checkSocket @socket, (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('Redis: something went wrong')
				done()

	describe 'with a valid cookie and no matching session', ->
		before ->
			@socket = {handshake: {_signedCookies: {'ol.sid': 'unknownId'}}}

		it 'should query redis', (done) ->
			@checkSocket @socket, () =>
				expect(@sessionStore.get.called).to.equal(true)
				done()

		it 'should return a lookup error', (done) ->
			@checkSocket @socket, (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('could not look up session by key')
				done()

	describe 'with a valid cookie and a matching session', ->
		before ->
			@socket = {handshake: {_signedCookies: {'ol.sid': @id1}}}

		it 'should query redis', (done) ->
			@checkSocket @socket, () =>
				expect(@sessionStore.get.called).to.equal(true)
				done()

		it 'should not return an error', (done) ->
			@checkSocket @socket, (error) ->
				expect(error).to.not.exist
				done()

		it 'should return the session', (done) ->
			@checkSocket @socket, (error, s, session) ->
				expect(session).to.deep.equal({user: {_id: '123'}})
				done()

	describe 'with a different valid cookie and matching session', ->
		before ->
			@socket = {handshake: {_signedCookies: {'ol.sid': @id2}}}

		it 'should query redis', (done) ->
			@checkSocket @socket, () =>
				expect(@sessionStore.get.called).to.equal(true)
				done()

		it 'should not return an error', (done) ->
			@checkSocket @socket, (error) ->
				expect(error).to.not.exist
				done()

		it 'should return the other session', (done) ->
			@checkSocket @socket, (error, s, session) ->
				expect(session).to.deep.equal({user: {_id: 'abc'}})
				done()
