should = require('chai').should()
async = require("async")
User = require "./helpers/User"

describe 'SettingsPage', ->

	before (done) ->
		@user = new User()
		async.series [
			@user.ensureUserExists.bind(@user)
			@user.login.bind(@user)
			@user.activateSudoMode.bind(@user)
		], done

	it 'load settigns page', (done) ->
		@user.getUserSettingsPage (err, statusCode) ->
			statusCode.should.equal 200
			done()

	it 'update main email address', (done) ->
		newEmail = 'foo@bar.com'
		@user.updateSettings email: newEmail, (error) =>
			should.not.exist error
			@user.get (error, user) ->
				user.email.should.equal newEmail
				user.emails.length.should.equal 1
				user.emails[0].email.should.equal newEmail
				done()
