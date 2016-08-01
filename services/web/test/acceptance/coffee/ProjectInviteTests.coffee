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
			uri: "/project/#{projectId}/invite",
			json:
				email: email
				privileges: 'readAndWrite'
		}, (err, response, body) ->
			return callback(err) if err
			callback(null, body.invite)

createProject = (owner, projectName, callback=(err, projectId, project)->) ->
	owner.createProject projectName, (err, projectId) ->
		throw err if err
		fakeProject = {
			_id: projectId,
			name: projectName,
			owner_ref: owner
		}
		callback(err, projectId, fakeProject)

createProjectAndInvite = (owner, projectName, email, callback=(err, project, invite)->) ->
	createProject owner, projectName, (err, projectId, project) ->
		return callback(err) if err
		createInvite owner, projectId, email, (err, invite) ->
			return callback(err) if err
			link =  CollaboratorsEmailHandler._buildInviteUrl(project, invite)
			callback(null, project, invite, link)

revokeInvite = (sendingUser, projectId, inviteId, callback=(err)->) ->
	sendingUser.getCsrfToken (err) ->
		return callback(err) if err
		sendingUser.request.delete {
			uri: "/project/#{projectId}/invite/#{inviteId}",
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

tryRegisterUser = (user, email, redir, callback=(err, response, body)->) ->
	user.getCsrfToken (error) =>
		return callback(error) if error?
		user.request.post {
			url: "/register"
			json:
				email: email
				password: "some_weird_password"
				redir: redir
		}, callback

tryFollowLoginLink = (user, loginLink, callback=(err, response, body)->) ->
	user.getCsrfToken (error) =>
		return callback(error) if error?
		user.request.get loginLink, callback

tryLoginUser = (user, redir, callback=(err, response, body)->) ->
	user.getCsrfToken (error) =>
		return callback(error) if error?
		user.request.post {
			url: "/login"
			json:
				email: user.email
				password: user.password
				redir: redir
		}, callback


# Expectations
expectProjectAccess = (user, projectId, callback=(err,result)->) ->
	# should have access to project
	user.openProject projectId, (err) =>
		expect(err).to.be.oneOf [null, undefined]
		callback()

expectNoProjectAccess = (user, projectId, callback=(err,result)->) ->
	# should not have access to project page
	user.openProject projectId, (err) =>
		expect(err).to.be.instanceof Error
		callback()

expectInvitePage = (user, link, callback=(err,result)->) ->
	# view invite
	tryFollowInviteLink user, link, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 200
		expect(body).to.match new RegExp("<title>Project Invite - .*</title>")
		callback()

expectInvalidInvitePage = (user, link, callback=(err,result)->) ->
	# view invalid invite
	tryFollowInviteLink user, link, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 200
		expect(body).to.match new RegExp("<title>Invalid Invite - .*</title>")
		callback()

expectInviteRedirectToRegister = (user, link, callback=(err,result)->) ->
	# view invite, redirect to `/register`
	tryFollowInviteLink user, link, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.match new RegExp("^/register\?.*redir=.*$")
		# follow redirect to register page and extract the redirectUrl from form
		user.request.get response.headers.location, (err, response, body) ->
			redirectUrl = body.match(/input name="redir" type="hidden" value="([^"]*)"/m)?[1]
			loginUrl = body.match(/href="([^"]*)">\s*Login here/m)?[1]
			expect(redirectUrl).to.not.be.oneOf [null, undefined]
			expect(loginUrl).to.not.be.oneOf [null, undefined]
			callback(null, redirectUrl, loginUrl)

expectLoginPage = (user, loginLink, callback=(err, result)->) ->
	tryFollowLoginLink user, loginLink, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 200
		expect(body).to.match new RegExp("<title>Login - .*</title>")
		redirectUrl = body.match(/input name="redir" type="hidden" value="([^"]*)"/m)?[1]
		callback(null, redirectUrl)

expectLoginRedirectToInvite = (user, redir, link, callback=(err, result)->) ->
	tryLoginUser user, redir, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 200
		expect(link).to.match new RegExp("^.*#{body.redir}\?.*$")
		callback(null, null)

expectRegistrationRedirectToInvite = (user, email, redir, link, callback=(err, result)->) ->
	tryRegisterUser user, email, redir, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 200
		expect(link).to.match new RegExp("^.*#{body.redir}\?.*$")
		callback(null, null)

expectInviteRedirectToProject = (user, link, invite, callback=(err,result)->) ->
	# view invite, redirect straight to project
	tryFollowInviteLink user, link, (err, response, body) ->
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/project/#{invite.projectId}"
		callback()

expectAcceptInviteAndRedirect = (user, invite, callback=(err,result)->) ->
	# should accept the invite and redirect to project
	tryAcceptInvite user, invite, (err, response, body) =>
		expect(err).to.be.oneOf [null, undefined]
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/project/#{invite.projectId}"
		callback()


describe "ProjectInviteTests", ->
	before (done) ->
		@sendingUser = new User()
		@user = new User()
		@site_admin = new User({email: "admin@example.com"})
		@email = 'smoketestuser@example.com'
		@projectName = 'sharing test'
		Async.series [
			(cb) => @user.login cb
			(cb) => @user.logout cb
			(cb) => @sendingUser.login cb
		], done

	describe 'clicking the invite link', ->

		beforeEach (done) ->
			@projectId = null
			@fakeProject = null
			done()


		describe "user is logged in already", ->

			beforeEach (done) ->
				Async.series [
					(cb) =>
						createProjectAndInvite @sendingUser, @projectName, @email, (err, project, invite, link) =>
							@projectId = project._id
							@fakeProject = project
							@invite = invite
							@link = link
							cb()
					(cb) =>
						@user.login (err) =>
							if err
								throw err
							cb()
				], done

			afterEach (done) ->
				Async.series [
					(cb) => @sendingUser.deleteProject(@projectId, cb)
					(cb) => @sendingUser.deleteProject(@projectId, cb)
					(cb) => revokeInvite(@sendingUser, @projectId, @invite._id, cb)
				], done

			describe 'user is already a member of the project', ->

				beforeEach (done) ->
					Async.series [
						(cb) => expectInvitePage @user, @link, cb
						(cb) => expectAcceptInviteAndRedirect @user, @invite, cb
					], done

				describe 'when user clicks on the invite a second time', ->

					it 'should just redirect to the project page', (done) ->
						Async.series [
							(cb) => expectProjectAccess @user, @invite.projectId, cb
							(cb) => expectInviteRedirectToProject @user, @link, @invite, cb
						], done

					describe 'when the user recieves another invite to the same project', ->

						it 'should redirect to the project page', (done) ->
							Async.series [
								(cb) =>
									createInvite @sendingUser, @projectId, @email, (err, invite) =>
										if err
											throw err
										@secondInvite = invite
										@secondLink = CollaboratorsEmailHandler._buildInviteUrl(@fakeProject, invite)
										cb()
								(cb) => expectInviteRedirectToProject @user, @secondLink, @secondInvite, cb
								(cb) => revokeInvite @sendingUser, @projectId, @secondInvite._id, cb
							], done


			describe 'user is not a member of the project', ->

				it 'should not grant access if the user does not accept the invite', (done) ->
					Async.series(
						[
							(cb) => expectInvitePage @user, @link, cb
							(cb) => expectNoProjectAccess @user, @invite.projectId, cb
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
							(cb) => expectInvitePage @user, @link, cb
							(cb) => expectAcceptInviteAndRedirect @user, @invite, cb
							(cb) => expectProjectAccess @user, @invite.projectId, cb
						], done
					)

		describe 'user is not logged in initially', ->

			before (done) ->
				@user.logout done

			beforeEach (done) ->
				Async.series [
					(cb) =>
						createProjectAndInvite @sendingUser, @projectName, @email, (err, project, invite, link) =>
							@projectId = project._id
							@fakeProject = project
							@invite = invite
							@link = link
							cb()
				], done

			afterEach (done) ->
				Async.series [
					(cb) => @sendingUser.deleteProject(@projectId, cb)
					(cb) => @sendingUser.deleteProject(@projectId, cb)
					(cb) => revokeInvite(@sendingUser, @projectId, @invite._id, cb)
				], done

			describe 'registration prompt workflow with valid token', ->

				it 'should redirect to the register page', (done) ->
					Async.series [
						(cb) => expectInviteRedirectToRegister(@user, @link, cb)
					], done

				it 'should allow user to accept the invite if the user registers a new account', (done) ->
					Async.series [
						(cb) =>
							expectInviteRedirectToRegister @user, @link, (err, redirectUrl) =>
								@_redir = redirectUrl
								cb()
						(cb) => expectRegistrationRedirectToInvite @user, "some_email@example.com", @_redir, @link, cb
						(cb) => expectInvitePage @user, @link, cb
						(cb) => expectAcceptInviteAndRedirect @user, @invite, cb
						(cb) => expectProjectAccess @user, @invite.projectId, cb
					], done

			describe 'registration prompt workflow with non-valid token', ->

				before (done)->
					@user.logout done

				it 'should redirect to the register page', (done) ->
					Async.series [
						(cb) => expectInviteRedirectToRegister(@user, @link, cb)
					], done

				it 'should display invalid-invite if the user registers a new account', (done) ->
					badLink = @link.replace(@invite.token, 'not_a_real_token')
					Async.series [
						(cb) =>
							expectInviteRedirectToRegister @user, badLink, (err, redirectUrl) =>
								@_redir = redirectUrl
								cb()
						(cb) => expectRegistrationRedirectToInvite @user, "some_email@example.com", @_redir, badLink, cb
						(cb) => expectInvalidInvitePage @user, badLink, cb
						(cb) => expectNoProjectAccess @user, @invite.projectId, cb
					], done

			describe 'login workflow with valid token', ->

				before (done)->
					@user.logout done

				it 'should redirect to the register page', (done) ->
					Async.series [
						(cb) => expectInviteRedirectToRegister(@user, @link, cb)
					], done

				it 'should allow the user to login to view the invite', (done) ->
					Async.series [
						(cb) =>
							expectInviteRedirectToRegister @user, @link, (err, redirectUrl, loginUrl) =>
								@_redir = redirectUrl
								@_loginLink = loginUrl
								cb()
						(cb) =>
							expectLoginPage @user, @_loginLink, (err, redirectUrl) =>
								expect(@_redir).to.equal redirectUrl
								cb()
						(cb) => expectLoginRedirectToInvite @user, @_redir, @link, cb
						(cb) => expectInvitePage @user, @link, cb
						(cb) => expectNoProjectAccess @user, @invite.projectId, cb
					], done


				it 'should allow user to accept the invite if the user registers a new account', (done) ->
					Async.series [
						(cb) => expectInvitePage @user, @link, cb
						(cb) => expectAcceptInviteAndRedirect @user, @invite, cb
						(cb) => expectProjectAccess @user, @invite.projectId, cb
					], done
