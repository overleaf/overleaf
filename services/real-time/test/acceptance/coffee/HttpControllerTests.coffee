async = require('async')
expect = require('chai').expect
request = require('request').defaults({
	baseUrl: 'http://localhost:3026'
})

RealTimeClient = require "./helpers/RealTimeClient"
FixturesManager = require "./helpers/FixturesManager"

describe 'HttpControllerTests', ->
	describe 'without a user', ->
		it 'should return 404 for the client view', (done) ->
			client_id = 'not-existing'
			request.get {
				url: "/clients/#{client_id}"
				json: true
			}, (error, response, data) ->
				return done(error) if error
				expect(response.statusCode).to.equal(404)
				done()

	describe 'with a user and after joining a project', ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
					}, (error, {@project_id, @user_id}) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {}, (error, {@doc_id}) =>
						cb(error)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb

				(cb) =>
					@client.emit "joinProject", {@project_id}, cb

				(cb) =>
					@client.emit "joinDoc", @doc_id, cb
			], done

		it 'should send a client view', (done) ->
			request.get {
				url: "/clients/#{@client.socket.sessionid}"
				json: true
			}, (error, response, data) =>
				return done(error) if error
				expect(response.statusCode).to.equal(200)
				expect(data.connected_time).to.exist
				delete data.connected_time
				# .email is not set in the session
				delete data.email
				expect(data).to.deep.equal({
					client_id: @client.socket.sessionid,
					first_name: 'Joe',
					last_name: 'Bloggs',
					project_id: @project_id,
					user_id: @user_id,
					rooms: [
						@project_id,
						@doc_id,
					]
				})
				done()
