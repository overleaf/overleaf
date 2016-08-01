expect = require("chai").expect
Async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
CollaboratorsEmailHandler = require "../../../app/js/Features/Collaborators/CollaboratorsEmailHandler"


createInvite = (sendingUser, projectId, email, callback=(err, invite)->) ->
	sendingUser.getCsrfToken (err) ->
		return callback(err) if err
		sendingUser.request.post {
			url: "/project/#{projectId}/invite",
			json:
				email: email
				privileges: 'readAndWrite'
		}, (err, response, body) ->
			return callback(err) if err
			callback(null, body.invite)

revokeInvite = (sendingUser, projectId, inviteId, callback=(err)->) ->
	sendingUser.getCsrfToken (err) ->
		return callback(err) if err
		sendingUser.request.delete {
			url: "/project/#{projectId}/invite/#{inviteId}",
		}, (err, response, body) ->
			return callback(err) if err
			callback(null)

# Actions
tryFollowInviteLink = (user, link, callback=(err, response, body)->) ->
	user.request.get {
		uri: link
		baseUrl: null
	}, callback

tryAcceptInvite = (user, invite, callback=(err, response, body)->) ->
	user.request.post {
		uri: "/project/#{invite.projectId}/invite/#{invite._id}/accept"
		json:
			token: invite.token
	}, callback


# Expectations
expectProjectAccess = (user, projectId, callback=()->) ->
	# should have access to project
	user.openProject projectId, (err) =>
		expect(err).to.be.oneOf [null, undefined]
		callback()

expectNoProjectAccess = (user, projectId, callback=()->) ->
	# should not have access to project page
	user.openProject projectId, (err) =>
		expect(err).to.be.instanceof Error
		callback()

expectInvitePage = (user, link, callback=()->) ->
	# view invite
	tryFollowInviteLink user, link, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 200
		expect(body).to.match new RegExp("<title>Project Invite - .*</title>")
		callback()

expectInvalidInvitePage = (user, link, callback=()->) ->
	# view invalid invite
	tryFollowInviteLink user, link, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 200
		expect(body).to.match new RegExp("<title>Invalid Invite - .*</title>")
		callback()

expectAcceptInviteAndRedirect = (user, invite, callback=()->) ->
	# should accept the invite and redirect to project
	tryAcceptInvite user, invite, (err, response, body) =>
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/project/#{invite.projectId}"
		callback()


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
			(cb) => @sendingUser.createProject(@projectName, (err, projectId) =>
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
				createInvite @sendingUser, @projectId, @email, (err, invite) =>
					@invite = invite
					@link = CollaboratorsEmailHandler._buildInviteUrl(@fakeProject, @invite)
					done()

			afterEach (done) ->
				revokeInvite @sendingUser, @projectId, @invite._id, (err) =>
					throw err if err
					done()

			it 'should not grant access if the user does not accept the invite', (done) ->
				Async.series(
					[
						(cb) =>
							expectInvitePage @user, @link, cb
						(cb) =>
							expectNoProjectAccess @user, @invite.projectId, cb
					], done
				)

			it 'should render the invalid-invite page if the token is invalid', (done) ->
				Async.series(
					[
						(cb) =>
							link = @link.replace(@invite.token, 'not_a_real_token')
							expectInvalidInvitePage @user, link, cb
						(cb) =>
							expectNoProjectAccess @user, @invite.projectId, cb
					], done
				)

			it 'should allow the user to accept the invite and access the project', (done) ->
				Async.series(
					[
						(cb) =>
							expectInvitePage @user, @link, cb
						(cb) =>
							expectAcceptInviteAndRedirect @user, @invite, cb
						(cb) =>
							expectProjectAccess @user, @invite.projectId, cb
					], done
				)
