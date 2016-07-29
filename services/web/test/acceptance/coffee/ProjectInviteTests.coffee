expect = require("chai").expect
Async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
CollaboratorsEmailHandler = require "../../../app/js/Features/Collaborators/CollaboratorsEmailHandler"


_createInvite = (projectId, sendingUser, email, callback=(err, invite)->) ->
	sendingUser.getCsrfToken (err) ->
		return callback(err) if err
		sendingUser.request.post {
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
		@email = 'smoketestuser@example.com'
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

		describe 'user is not a member of the project', ->

			beforeEach (done) ->
				@invite = null
				@link = null
				_createInvite @projectId, @sendingUser, @email, (err, invite) =>
					@invite = invite
					@link = CollaboratorsEmailHandler._buildInviteUrl(@fakeProject, @invite)
					done()

			it 'should render the invite page', (done) ->
				Async.series(
					[
						(cb) =>
							@user.request.get {
								uri: @link
								baseUrl: null
							}, (err, response, body) =>
								expect(err).to.be.oneOf [null, undefined]
								expect(response.statusCode).to.equal 200
								expect(body).to.match new RegExp("<title>Project Invite - .*</title>")
								cb()

					], (err, result) =>
						if err
							throw err
						done()
				)
