expect = require("chai").expect
Async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
CollaboratorsEmailHandler = require "../../../app/js/Features/Collaborators/CollaboratorsEmailHandler"


_createInvite = (projectId, user, email, callback=(err, invite)->) ->
	user.getCsrfToken (err) ->
		return callback(err) if err
		user.request.post {
			url: "/project/#{projectId}/invite",
			json:
				email: email
		}, (err, response, body) ->
			return callback(err) if err
			callback(err, body.invite)

describe "ProjectInviteTests", ->
	before (done) ->
		@timeout(20000)
		@sendingUser = new User()
		@user = new User()
		@site_admin = new User({email: "admin@example.com"})
		@email = 'user@example.com'
		@projectName = 'sharing test'
		@projectId = null
		@fakeProject = null
		Async.series [
			(cb) => @user.login cb
			(cb) => @sendingUser.login cb
			(cb) => @sendingUser.createProject(@projectName, (err, projectId, project) =>
				throw err if err
				@projectId = projectId
				@fakeProject = {
					_id: projectId,
					name: @projectName,
					owner_ref: @sendingUser
				}
				cb()
			)
		], done

		after (done) ->
			Async.series [
				(cb) => @sendingUser.deleteProject(@projectId, cb)
			], done

	describe "user is logged in", ->

		beforeEach (done) ->
			@user.login (err) =>
				if err
					throw err
				done()

		describe 'user is already a member of the project', ->

			beforeEach (done) ->
				@invite = null
				@link = null
				_createInvite @projectId, @sendingUser, @email, (err, invite) =>
					@invite = invite
					@link = CollaboratorsEmailHandler._buildInviteUrl(@fakeProject, @invite)
					done()

			it 'should redirect to the project page', (done) ->
				Async.series(
					[
						(cb) =>
							console.log ">> yes"
							cb()

					], (err, result) =>
						if err
							throw err
						done()
				)
