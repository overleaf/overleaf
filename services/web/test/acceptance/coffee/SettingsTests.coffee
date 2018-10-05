should = require('chai').should()
async = require("async")
User = require "./helpers/User"
MockV1Api = require './helpers/MockV1Api'

describe 'SettingsPage', ->

	before (done) ->
		@user = new User()
		@v1Id = 1234
		@v1User =
			id: @v1Id
			email: @user.email
			password: @user.password
			profile:
				id: @v1Id
				email: @user.email
		async.series [
			@user.ensureUserExists.bind(@user)
			@user.login.bind(@user)
			(cb) => @user.mongoUpdate {$set: {'overleaf.id': @v1Id}}, cb
			(cb) =>
				MockV1Api.setUser @v1Id, @v1User
				cb()
			@user.activateSudoMode.bind(@user)
		], done

	it 'load settings page', (done) ->
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
