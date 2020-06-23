async = require "async"
{expect} = require("chai")

RealTimeClient = require "./helpers/RealTimeClient"
FixturesManager = require "./helpers/FixturesManager"


describe "Router", ->
	describe "joinProject", ->
		describe "when there is no callback provided", ->
			after () ->
				process.removeListener('unhandledRejection', @onUnhandled)

			before (done) ->
				@onUnhandled = (error) ->
					done(error)
				process.on('unhandledRejection', @onUnhandled)
				async.series [
					(cb) =>
						FixturesManager.setUpProject {
							privilegeLevel: "owner"
							project: {
								name: "Test Project"
							}
						}, (e, {@project_id, @user_id}) =>
							cb(e)

					(cb) =>
						@client = RealTimeClient.connect()
						@client.on "connectionAccepted", cb

					(cb) =>
						@client = RealTimeClient.connect()
						@client.on "connectionAccepted", cb

					(cb) =>
						@client.emit "joinProject", project_id: @project_id
						setTimeout(cb, 100)
				], done

			it "should keep on going", ->
				expect('still running').to.exist

		describe "when there are too many arguments", ->
			after () ->
				process.removeListener('unhandledRejection', @onUnhandled)

			before (done) ->
				@onUnhandled = (error) ->
					done(error)
				process.on('unhandledRejection', @onUnhandled)
				async.series [
					(cb) =>
						FixturesManager.setUpProject {
							privilegeLevel: "owner"
							project: {
								name: "Test Project"
							}
						}, (e, {@project_id, @user_id}) =>
							cb(e)

					(cb) =>
						@client = RealTimeClient.connect()
						@client.on "connectionAccepted", cb

					(cb) =>
						@client = RealTimeClient.connect()
						@client.on "connectionAccepted", cb

					(cb) =>
						@client.emit "joinProject", 1, 2, 3, 4, 5, (@error) =>
							cb()
				], done

			it "should return an error message", ->
				expect(@error.message).to.equal('unexpected arguments')
