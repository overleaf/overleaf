expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
{db, ObjectId} = require("../../../app/js/infrastructure/mongojs")
MockV1Api = require "./helpers/MockV1Api"

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
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# There should only be one confirmation token at the moment
						expect(tokens.length).to.equal 1
						expect(tokens[0].data.email).to.equal 'newly-added-email@example.com'
						expect(tokens[0].data.user_id).to.equal @user._id
						token = tokens[0].token
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
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# Token should be deleted after use
						expect(tokens.length).to.equal 0
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
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# There should only be one confirmation token at the moment
						expect(tokens.length).to.equal 1
						expect(tokens[0].data.email).to.equal @email
						expect(tokens[0].data.user_id).to.equal @user._id
						token1 = tokens[0].token
						cb()
				(cb) =>
					# Delete the email from the first user
					@user.request {
						method: 'POST',
						url: '/user/emails/delete',
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
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user2._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# The first token has been used, so this should be token2 now
						expect(tokens.length).to.equal 1
						expect(tokens[0].data.email).to.equal @email
						expect(tokens[0].data.user_id).to.equal @user2._id
						token2 = tokens[0].token
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

	describe "with an expired token", ->
		it 'should not confirm the email', (done) ->
			token = null
			async.series [
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails',
						json:
							email: @email = 'expired-token-email@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 204
						cb()
				(cb) =>
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# There should only be one confirmation token at the moment
						expect(tokens.length).to.equal 1
						expect(tokens[0].data.email).to.equal @email
						expect(tokens[0].data.user_id).to.equal @user._id
						token = tokens[0].token
						cb()
				(cb) =>
					db.tokens.update {
						token: token
					}, {
						$set: {
							expiresAt: new Date(Date.now() - 1000000)
						}
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/confirm',
						json:
							token: token
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 404
						cb()
			], done

	describe 'resending the confirmation', ->
		it 'should generate a new token', (done) ->
			async.series [
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails',
						json:
							email: 'reconfirmation-email@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 204
						cb()
				(cb) =>
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# There should only be one confirmation token at the moment
						expect(tokens.length).to.equal 1
						expect(tokens[0].data.email).to.equal 'reconfirmation-email@example.com'
						expect(tokens[0].data.user_id).to.equal @user._id
						cb()
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/resend_confirmation',
						json:
							email: 'reconfirmation-email@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 200
						cb()
				(cb) =>
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# There should be two tokens now
						expect(tokens.length).to.equal 2
						expect(tokens[0].data.email).to.equal 'reconfirmation-email@example.com'
						expect(tokens[0].data.user_id).to.equal @user._id
						expect(tokens[1].data.email).to.equal 'reconfirmation-email@example.com'
						expect(tokens[1].data.user_id).to.equal @user._id
						cb()
			], done

		it 'should create a new token if none exists', (done) ->
			# This should only be for users that have sign up with their main
			# emails before the confirmation system existed
			async.series [
				(cb) =>
					db.tokens.remove {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/resend_confirmation',
						json:
							email: @user.email
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 200
						cb()
				(cb) =>
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						# There should still only be one confirmation token
						expect(tokens.length).to.equal 1
						expect(tokens[0].data.email).to.equal @user.email
						expect(tokens[0].data.user_id).to.equal @user._id
						cb()
			], done

		it "should not allow reconfirmation if the email doesn't match the user", (done) ->
			async.series [
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/resend_confirmation',
						json:
							email: 'non-matching-email@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 422
						cb()
				(cb) =>
					db.tokens.find {
						use: 'email_confirmation',
						'data.user_id': @user._id,
						usedAt: { $exists: false }
					}, (error, tokens) =>
						expect(tokens.length).to.equal 0
						cb()
			], done

	describe 'setting a default email', ->
		it 'should update confirmed emails for users not in v1', (done) ->
			token = null
			async.series [
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails',
						json:
							email: 'new-confirmed-default@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 204
						cb()
				(cb) =>
					# Mark the email as confirmed
					db.users.update {
						'emails.email': 'new-confirmed-default@example.com'
					}, { 
						$set: {
							'emails.$.confirmedAt': new Date()
						}
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/default',
						json:
							email: 'new-confirmed-default@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 200
						cb()
				(cb) =>
					@user.request { url: '/user/emails', json: true }, (error, response, body) ->
						expect(response.statusCode).to.equal 200
						expect(body[0].confirmedAt).to.not.exist
						expect(body[0].default).to.equal false
						expect(body[1].confirmedAt).to.exist
						expect(body[1].default).to.equal true
						cb()
			], done

		it 'should not allow changing unconfirmed emails in v1', (done) ->
			token = null
			async.series [
				(cb) =>
					db.users.update {
						_id: ObjectId(@user._id)
					}, {
						$set: {
							'overleaf.id': 42
						}
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails',
						json:
							email: 'new-unconfirmed-default@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 204
						cb()
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/default',
						json:
							email: 'new-unconfirmed-default@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 409
						cb()
				(cb) =>
					@user.request { url: '/user/emails', json: true }, (error, response, body) ->
						expect(body[0].default).to.equal true
						expect(body[1].default).to.equal false
						cb()
			], done

		it 'should update the email in v1 if confirmed', (done) ->
			token = null
			async.series [
				(cb) =>
					db.users.update {
						_id: ObjectId(@user._id)
					}, {
						$set: {
							'overleaf.id': 42
						}
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails',
						json:
							email: 'new-confirmed-default-in-v1@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 204
						cb()
				(cb) =>
					# Mark the email as confirmed
					db.users.update {
						'emails.email': 'new-confirmed-default-in-v1@example.com'
					}, { 
						$set: {
							'emails.$.confirmedAt': new Date()
						}
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/default',
						json:
							email: 'new-confirmed-default-in-v1@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 200
						cb()
			], (error) =>
				return done(error) if error?
				expect(
					MockV1Api.updateEmail.calledWith(42, 'new-confirmed-default-in-v1@example.com')
				).to.equal true
				done()

		it 'should return an error if the email exists in v1', (done) ->
			MockV1Api.existingEmails.push 'exists-in-v1@example.com'
			async.series [
				(cb) =>
					db.users.update {
						_id: ObjectId(@user._id)
					}, {
						$set: {
							'overleaf.id': 42
						}
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails',
						json:
							email: 'exists-in-v1@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 204
						cb()
				(cb) =>
					# Mark the email as confirmed
					db.users.update {
						'emails.email': 'exists-in-v1@example.com'
					}, { 
						$set: {
							'emails.$.confirmedAt': new Date()
						}
					}, cb
				(cb) =>
					@user.request {
						method: 'POST',
						url: '/user/emails/default',
						json:
							email: 'exists-in-v1@example.com'
					}, (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 409
						expect(body.error).to.deep.equal {
							message: "The email 'exists-in-v1@example.com' is already in use by another account"
						}
						cb()
				(cb) =>
					@user.request { url: '/user/emails', json: true }, (error, response, body) ->
						expect(body[0].default).to.equal true
						expect(body[1].default).to.equal false
						cb()
			], done