expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
redis = require "./helpers/redis"

describe "Sessions", ->
	before (done) ->
		@timeout(10000)
		@user1 = new User()
		@site_admin = new User({email: "admin@example.com"})
		async.series [
			(cb) => @user1.login cb
			(cb) => @user1.logout cb
		], done

	describe "one session", ->

		it "should have one session in UserSessions", (done) ->
			async.series(
				[
					(next) =>
						redis.clearUserSessions @user1, next

					# login, should add session to set
					, (next) =>
						@user1.login (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user1, (err, sessions) =>
							expect(sessions.length).to.equal 1
							expect(sessions[0].slice(0, 5)).to.equal 'sess:'
							next()

					# logout, should remove session from set
					, (next) =>
						@user1.logout (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user1, (err, sessions) =>
							expect(sessions.length).to.equal 0
							next()

				], (err, result) =>
					if err
						throw err
					done()
			)
