expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
rclient = require("redis-sharelatex").createClient(settings.redis.web)

describe "UserEmails", ->
	beforeEach (done) ->
		@timeout(20000)
		@user = new User()
		@user.login done

	describe 'confirming an email', ->
		it 'should confirm the email', (done) ->
			token = null
			async.series [
				(cb) =>
					@user.request { 
						method: 'POST',
						url: '/user/emails',
						json:
							email: 'newly-added-email@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 204
						cb()
				(cb) =>
					@user.request { url: '/user/emails', json: true }, (error, response, body) ->
						expect(response.statusCode).to.equal 200
						expect(body[0].confirmedAt).to.not.exist
						expect(body[1].confirmedAt).to.not.exist
						cb()
				(cb) =>
					rclient.keys 'email_confirmation_token:*', (error, keys) ->
						# There should only be one confirmation token at the moment
						expect(keys.length).to.equal 1
						token = keys[0].split(':')[1]
						cb()
				(cb) =>
					@user.request { 
						method: 'POST',
						url: '/user/emails/confirm',
						json:
							token: token
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 200
						cb()
				(cb) =>
					@user.request { url: '/user/emails', json: true }, (error, response, body) ->
						expect(response.statusCode).to.equal 200
						expect(body[0].confirmedAt).to.not.exist
						expect(body[1].confirmedAt).to.exist
						cb()
				(cb) =>
					rclient.keys 'email_confirmation_token:*', (error, keys) ->
						# Token should be deleted after use
						expect(keys.length).to.equal 0
						cb()
			], done

		it 'should not allow confirmation of the email if the user has changed', (done) ->
			token1 = null
			token2 = null
			@user2 = new User()
			@email = 'duplicate-email@example.com'
			async.series [
				(cb) => @user2.login cb
				(cb) =>
					# Create email for first user
					@user.request { 
						method: 'POST',
						url: '/user/emails',
						json: {@email}
					}, cb
				(cb) =>
					rclient.keys 'email_confirmation_token:*', (error, keys) ->
						# There should only be one confirmation token at the moment,
						# for the first user
						expect(keys.length).to.equal 1
						token1 = keys[0].split(':')[1]
						cb()
				(cb) =>
					# Delete the email from the first user
					@user.request { 
						method: 'DELETE',
						url: '/user/emails',
						json: {@email}
					}, cb
				(cb) =>
					# Create email for second user
					@user2.request { 
						method: 'POST',
						url: '/user/emails',
						json: {@email}
					}, cb
				(cb) =>
					# Original confirmation token should no longer work
					@user.request { 
						method: 'POST',
						url: '/user/emails/confirm',
						json:
							token: token1
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 404
						cb()
				(cb) =>
					rclient.keys 'email_confirmation_token:*', (error, keys) ->
						# The first token has been used, so this should be token2 now
						expect(keys.length).to.equal 1
						token2 = keys[0].split(':')[1]
						cb()
				(cb) =>
					# Second user should be able to confirm the email
					@user2.request { 
						method: 'POST',
						url: '/user/emails/confirm',
						json:
							token: token2
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 200
						cb()
				(cb) =>
					@user2.request { url: '/user/emails', json: true }, (error, response, body) ->
						expect(response.statusCode).to.equal 200
						expect(body[0].confirmedAt).to.not.exist
						expect(body[1].confirmedAt).to.exist
						cb()
			], done
