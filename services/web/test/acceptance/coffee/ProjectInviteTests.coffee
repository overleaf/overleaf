expect = require("chai").expect
Async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
CollaboratorsEmailHandler = require "../../../app/js/Features/Collaborators/CollaboratorsEmailHandler"


createInvite = (projectId, sendingUser, email, callback=(err, invite)->) ->
	sendingUser.getCsrfToken (err) ->
		return callback(err) if err
		sendingUser.request.post {
			url: "/project/#{projectId}/invite",
			json:
				email: email
				privileges: 'readAndWrite'
		}, (err, response, body) ->
			return callback(err) if err
			callback(err, body.invite)

followInviteLink = (user, link, callback=(err, response, body)->) ->
	user.request.get {
		uri: link
		baseUrl: null
	}, callback

acceptInvite = (user, invite, callback=(err, response, body)->) ->
	user.request.post {
		uri: "/project/#{invite.projectId}/invite/#{invite._id}/accept"
		json:
			token: invite.token
	}, callback


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
				createInvite @projectId, @sendingUser, @email, (err, invite) =>
					@invite = invite
					@link = CollaboratorsEmailHandler._buildInviteUrl(@fakeProject, @invite)
					done()

			it 'should not grant access if the user does not accept the invite', (done) ->
				Async.series(
					[
						# go to the invite page
						(cb) =>
							followInviteLink @user, @link, (err, response, body) =>
								expect(err).to.be.oneOf [null, undefined]
								expect(response.statusCode).to.equal 200
								expect(body).to.match new RegExp("<title>Project Invite - .*</title>")
								cb()

						# forbid access to the project page
						(cb) =>
							@user.openProject @invite.projectId, (err) =>
								expect(err).to.be.instanceof Error
								cb()

					], done
				)

			it 'should render the invalid-invite page if the token is invalid', (done) ->
				Async.series(
					[
						# go to the invite page with an invalid token
						(cb) =>
							link = @link.replace(@invite.token, 'not_a_real_token')
							followInviteLink @user, link, (err, response, body) =>
								expect(err).to.be.oneOf [null, undefined]
								expect(response.statusCode).to.equal 200
								expect(body).to.match new RegExp("<title>Invalid Invite - .*</title>")
								cb()

						# forbid access to the project page
						(cb) =>
							@user.openProject @invite.projectId, (err) =>
								expect(err).to.be.instanceof Error
								cb()

					], done
				)

			it 'should allow the user to accept the invite and access the project', (done) ->
				Async.series(
					[
						# go to the invite page
						(cb) =>
							followInviteLink @user, @link, (err, response, body) =>
								expect(err).to.be.oneOf [null, undefined]
								expect(response.statusCode).to.equal 200
								expect(body).to.match new RegExp("<title>Project Invite - .*</title>")
								cb()

						# accept the invite
						(cb) =>
							acceptInvite @user, @invite, (err, response, body) =>
								expect(err).to.be.oneOf [null, undefined]
								expect(response.statusCode).to.equal 302
								expect(response.headers.location).to.equal "/project/#{@invite.projectId}"
								cb()

						# access the project page
						(cb) =>
							@user.openProject @invite.projectId, (err) =>
								expect(err).to.be.oneOf [null, undefined]
								cb()

					], done
				)
