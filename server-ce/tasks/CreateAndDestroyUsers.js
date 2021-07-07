
module.exports = (grunt) ->

	grunt.registerTask 'user:create-admin', "Create a user with the given email address and make them an admin. Update in place if the user already exists. Usage: grunt user:create-admin --email joe@example.com", () ->
		done = @async()
		email = grunt.option("email")
		if !email?
			console.error "Usage: grunt user:create-admin --email=joe@example.com"
			process.exit(1)

		settings = require "settings-sharelatex"
		mongodb = require "../web/app/src/infrastructure/mongodb"
		UserRegistrationHandler = require "../web/app/src/Features/User/UserRegistrationHandler"
		OneTimeTokenHandler = require "../web/app/src/Features/Security/OneTimeTokenHandler"
		mongodb.waitForDb().then () ->
			UserRegistrationHandler.registerNewUser {
				email: email
				password: require("crypto").randomBytes(32).toString("hex")
			}, (error, user) ->
				if error? and error?.message != "EmailAlreadyRegistered"
					throw error
				user.isAdmin = true
				user.save (error) ->
					throw error if error?
					ONE_WEEK = 7 * 24 * 60 * 60 # seconds
					OneTimeTokenHandler.getNewToken "password", { expiresIn: ONE_WEEK, email:user.email, user_id: user._id.toString() }, (err, token)->
						return next(err) if err?

						console.log ""
						console.log """
							Successfully created #{email} as an admin user.

							Please visit the following URL to set a password for #{email} and log in:

								#{settings.siteUrl}/user/password/set?passwordResetToken=#{token}

						"""
						done()

	grunt.registerTask 'user:delete', "deletes a user and all their data, Usage: grunt user:delete --email joe@example.com", () ->
		done = @async()
		email = grunt.option("email")
		if !email?
			console.error "Usage: grunt user:delete --email=joe@example.com"
			process.exit(1)
		settings = require "settings-sharelatex"
		mongodb = require "../web/app/src/infrastructure/mongodb"
		UserGetter = require "../web/app/src/Features/User/UserGetter"
		UserDeleter = require "../web/app/src/Features/User/UserDeleter"
		mongodb.waitForDb().then () ->
			UserGetter.getUser email:email, (error, user) ->
				if error?
					throw error
				if !user?
					console.log("user #{email} not in database, potentially already deleted")
					return done()
				UserDeleter.deleteUser user._id, (err)->
					if err?
						throw err
					done()
