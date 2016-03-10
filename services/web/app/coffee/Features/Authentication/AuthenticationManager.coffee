Settings = require 'settings-sharelatex'
User = require("../../models/User").User
{db, ObjectId} = require("../../infrastructure/mongojs")
crypto = require 'crypto'
bcrypt = require 'bcrypt'

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
							callback null, user
						else
							callback null, null
				else
					callback null, null
			else
				callback null, null

	setUserPassword: (user_id, password, callback = (error) ->) ->
		bcrypt.genSalt 7, (error, salt) ->
			return callback(error) if error?
			bcrypt.hash password, salt, (error, hash) ->
				return callback(error) if error?
				db.users.update({
					_id: ObjectId(user_id.toString())
				}, {
					$set: hashedPassword: hash
					$unset: password: true
				}, callback)

