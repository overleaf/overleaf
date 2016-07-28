expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
redis = require "./helpers/redis"

describe "Sessions", ->
	before (done) ->
		@timeout(20000)
		@user1 = new User()
		@site_admin = new User({email: "admin@example.com"})
		async.series [
			(cb) => @user1.login cb
			(cb) => @user1.logout cb
		], done

	describe "one session", ->

		it "should have one session in UserSessions set", (done) ->
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

					# should be able to access settings page
					, (next) =>
						@user1.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 200
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

	describe "two sessions", ->

		before ->
			# set up second session for this user
			@user2 = new User()
			@user2.email = @user1.email
			@user2.password = @user1.password

		it "should have two sessions in UserSessions set", (done) ->
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

					# login again, should add the second session to set
					, (next) =>
						@user2.login (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user1, (err, sessions) =>
							expect(sessions.length).to.equal 2
							expect(sessions[0].slice(0, 5)).to.equal 'sess:'
							expect(sessions[1].slice(0, 5)).to.equal 'sess:'
							next()

					# both should be able to access settings page
					, (next) =>
						@user1.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 200
							next()

					, (next) =>
						@user2.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 200
							next()

					# logout first session, should remove session from set
					, (next) =>
						@user1.logout (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user1, (err, sessions) =>
							expect(sessions.length).to.equal 1
							next()

					# first session should not have access to settings page
					, (next) =>
						@user1.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 302
							next()

					# second session should still have access to settings
					, (next) =>
						@user2.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 200
							next()

					# logout second session, should remove last session from set
					, (next) =>
						@user2.logout (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user1, (err, sessions) =>
							expect(sessions.length).to.equal 0
							next()

					# second session should not have access to settings page
					, (next) =>
						@user2.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 302
							next()

				], (err, result) =>
					if err
						throw err
					done()
			)

	describe 'three sessions, password reset', ->

		before ->
			# set up second session for this user
			@user2 = new User()
			@user2.email = @user1.email
			@user2.password = @user1.password
			@user3 = new User()
			@user3.email = @user1.email
			@user3.password = @user1.password

		it "should erase both sessions when password is reset", (done) ->
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

					# login again, should add the second session to set
					, (next) =>
						@user2.login (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user1, (err, sessions) =>
							expect(sessions.length).to.equal 2
							expect(sessions[0].slice(0, 5)).to.equal 'sess:'
							expect(sessions[1].slice(0, 5)).to.equal 'sess:'
							next()

					# login third session, should add the second session to set
					, (next) =>
						@user3.login (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user1, (err, sessions) =>
							expect(sessions.length).to.equal 3
							expect(sessions[0].slice(0, 5)).to.equal 'sess:'
							expect(sessions[1].slice(0, 5)).to.equal 'sess:'
							next()

					# password reset from second session, should erase two of the three sessions
					, (next) =>
						@user2.changePassword (err) ->
							next(err)

					, (next) =>
						redis.getUserSessions @user2, (err, sessions) =>
							expect(sessions.length).to.equal 1
							next()

					# users one and three should not be able to access settings page
					, (next) =>
						@user1.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 302
							next()

					, (next) =>
						@user3.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 302
							next()

					# user two should still be logged in, and able to access settings page
					, (next) =>
						@user2.getUserSettingsPage (err, statusCode) =>
							expect(err).to.equal null
							expect(statusCode).to.equal 200
							next()

					# logout second session, should remove last session from set
					, (next) =>
						@user2.logout (err) ->
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
