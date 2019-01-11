Settings = require "settings-sharelatex"
User = require("../../models/User").User
{db, ObjectId} = require("../../infrastructure/mongojs")
crypto = require 'crypto'
bcrypt = require 'bcrypt'
EmailHelper = require("../Helpers/EmailHelper")
Errors = require("../Errors/Errors")
UserGetter = require("../User/UserGetter")
V1Handler = require '../V1/V1Handler'

BCRYPT_ROUNDS = Settings?.security?.bcryptRounds or 12

_checkWriteResult = (result, callback = (error, updated) ->) ->
	# for MongoDB
	if result and result.nModified == 1
		callback(null, true)
	else
		callback(null, false)

module.exports = AuthenticationManager =
	authenticate: (query, password, callback = (error, user) ->) ->
		# Using Mongoose for legacy reasons here. The returned User instance
		# gets serialized into the session and there may be subtle differences
		# between the user returned by Mongoose vs mongojs (such as default values)
		User.findOne query, (error, user) =>
			return callback(error) if error?
			if user?
				if user.hashedPassword?
					bcrypt.compare password, user.hashedPassword, (error, match) ->
						return callback(error) if error?
						if match
							AuthenticationManager.checkRounds user, user.hashedPassword, password, (err) ->
								return callback(err) if err?
								callback null, user
						else
							callback null, null
				else
					callback null, null
			else
				callback null, null

	validateEmail: (email) ->
		parsed = EmailHelper.parseEmail(email)
		if !parsed?
			return { message: 'email not valid' }
		return null

	# validates a password based on a similar set of rules to `complexPassword.js` on the frontend
	# note that `passfield.js` enforces more rules than this, but these are the most commonly set.
	# returns null on success, or an error string.
	validatePassword: (password) ->
		return { message: 'password not set' } unless password?

		allowAnyChars = Settings.passwordStrengthOptions?.allowAnyChars == true
		min = Settings.passwordStrengthOptions?.length?.min || 6
		max = Settings.passwordStrengthOptions?.length?.max || 72

		# we don't support passwords > 72 characters in length, because bcrypt truncates them
		max = 72 if max > 72

		return { message: 'password is too short' } unless password.length >= min
		return { message: 'password is too long' } unless password.length <= max
		return { message: 'password contains an invalid character' } unless allowAnyChars || AuthenticationManager._passwordCharactersAreValid(password)
		return null

	setUserPassword: (user_id, password, callback = (error, changed) ->) ->
		validation = @validatePassword(password)
		return callback(validation.message) if validation?

		UserGetter.getUser user_id, { email:1, overleaf: 1 }, (error, user) ->
			return callback(error) if error?
			v1IdExists = user.overleaf?.id?
			if v1IdExists and Settings.overleaf? # v2 user in v2
				# v2 user in v2, change password in v1
				AuthenticationManager.setUserPasswordInV1(user.overleaf.id, password, callback)
			else if v1IdExists and !Settings.overleaf?
				# v2 user in SL
				return callback(new Errors.NotInV2Error("Password Reset Attempt"))
			else if !v1IdExists and !Settings.overleaf?
				# SL user in SL, change password in SL
				AuthenticationManager.setUserPasswordInV2(user_id, password, callback)
			else if !v1IdExists and Settings.overleaf?
				# SL user in v2, should not happen
				return callback(new Errors.SLInV2Error("Password Reset Attempt"))
			else
				return callback(new Error("Password Reset Attempt Failed"))

	checkRounds: (user, hashedPassword, password, callback = (error) ->) ->
		# check current number of rounds and rehash if necessary
		currentRounds = bcrypt.getRounds hashedPassword
		if currentRounds < BCRYPT_ROUNDS
			AuthenticationManager.setUserPassword user._id, password, callback
		else
			callback()

	setUserPasswordInV2: (user_id, password, callback) ->
		validation = @validatePassword(password)
		return callback(validation.message) if validation?

		bcrypt.genSalt BCRYPT_ROUNDS, (error, salt) ->
			return callback(error) if error?
			bcrypt.hash password, salt, (error, hash) ->
				return callback(error) if error?
				db.users.update({
					_id: ObjectId(user_id.toString())
				}, {
					$set: hashedPassword: hash
					$unset: password: true
				}, (updateError, result)->
					return callback(updateError) if updateError?
					_checkWriteResult(result, callback)
				)

	setUserPasswordInV1: (v1_user_id, password, callback) ->
		validation = @validatePassword(password)
		return callback(validation.message) if validation?

		V1Handler.doPasswordReset v1_user_id, password, (error, reset)->
			return callback(error) if error?
			return callback(error, reset)

	_passwordCharactersAreValid: (password) ->
		digits = Settings.passwordStrengthOptions?.chars?.digits || '1234567890'
		letters = Settings.passwordStrengthOptions?.chars?.letters || 'abcdefghijklmnopqrstuvwxyz'
		letters_up = Settings.passwordStrengthOptions?.chars?.letters_up || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
		symbols = Settings.passwordStrengthOptions?.chars?.symbols || '@#$%^&*()-_=+[]{};:<>/?!£€.,'

		for charIndex in [0..password.length - 1]
			return false unless digits.indexOf(password[charIndex]) > -1 or
				letters.indexOf(password[charIndex]) > -1 or
				letters_up.indexOf(password[charIndex]) > -1 or
				symbols.indexOf(password[charIndex]) > -1
		return true
