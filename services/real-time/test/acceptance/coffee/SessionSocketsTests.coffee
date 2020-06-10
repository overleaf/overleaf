RealTimeClient = require("./helpers/RealTimeClient")
Settings = require("settings-sharelatex")
{expect} = require('chai')

describe 'SessionSockets', ->
	before ->
		@checkSocket = (fn) ->
			client = RealTimeClient.connect()
			client.on 'connectionAccepted', fn
			client.on 'connectionRejected', fn
			return null

	describe 'without cookies', ->
		before ->
			RealTimeClient.cookie = null

		it 'should return a lookup error', (done) ->
			@checkSocket (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('invalid session')
				done()

	describe 'with a different cookie', ->
		before ->
			RealTimeClient.cookie = "some.key=someValue"

		it 'should return a lookup error', (done) ->
			@checkSocket (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('invalid session')
				done()

	describe 'with an invalid cookie', ->
		before (done) ->
			RealTimeClient.setSession {}, (error) ->
				return done(error) if error
				RealTimeClient.cookie = "#{Settings.cookieName}=#{
					RealTimeClient.cookie.slice(17, 49)
				}"
				done()
			return null

		it 'should return a lookup error', (done) ->
			@checkSocket (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('invalid session')
				done()

	describe 'with a valid cookie and no matching session', ->
		before ->
			RealTimeClient.cookie = "#{Settings.cookieName}=unknownId"

		it 'should return a lookup error', (done) ->
			@checkSocket (error) ->
				expect(error).to.exist
				expect(error.message).to.equal('invalid session')
				done()

	describe 'with a valid cookie and a matching session', ->
		before (done) ->
			RealTimeClient.setSession({}, done)
			return null

		it 'should not return an error', (done) ->
			@checkSocket (error) ->
				expect(error).to.not.exist
				done()
