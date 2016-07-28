expect = require("chai").expect
Async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"

describe "ProjectInviteTests", ->
	before (done) ->
		@timeout(20000)
		@sendingUser = new User()
		@user = new User()
		@site_admin = new User({email: "admin@example.com"})
		@projectId = null
		Async.series [
			(cb) => @user.login cb
			(cb) => @user.logout cb
			(cb) => @sendingUser.login cb
			(cb) => @sendingUser.createProject('sharing test', (err, projectId) =>
				throw err if err
				@projectId = projectId
				cb()
			)
			(cb) => @sendingUser.logout cb
		], done

	describe "user is logged in", ->

		beforeEach (done) ->
			@user.login (err) =>
				if err
					throw err
				done()

		describe 'user is already a member of the project', ->

			beforeEach ->

			it 'should redirect to the project page', (done) ->
				Async.series(
					[
						(cb) =>
							cb()



					], (err, result) =>
						if err
							throw err
						done()
				)
