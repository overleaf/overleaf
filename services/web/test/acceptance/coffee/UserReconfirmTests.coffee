expect = require("chai").expect
should = require('chai').should()
async = require("async")
User = require "./helpers/User"

describe 'User Must Reconfirm', ->

	before (done) ->
		@user = new User()
		async.series [
			@user.ensureUserExists.bind(@user)
			(cb) => @user.mongoUpdate {$set: {'must_reconfirm': true}}, cb
		], done

	it 'should not allow sign in', (done) ->
		@user.login (err) =>
			expect(err?).to.equal false
			@user.isLoggedIn (err, isLoggedIn) ->
				expect(isLoggedIn).to.equal false
				done()

	describe 'Requesting reconfirmation email', ->
		it 'should return a success to client for existing account', (done) ->
			@user.reconfirmAccountRequest @user.email, (err, response) =>
				expect(err?).to.equal false
				expect(response.statusCode).to.equal 200
				done()

		it 'should return a 404 to client for non-existent account', (done) ->
			@user.reconfirmAccountRequest 'fake@overleaf.com', (err, response) =>
				expect(err?).to.equal false
				expect(response.statusCode).to.equal 404
				done()