crypto = require('crypto')

ALGORITHM = 'aes-256-ctr'

keyFn = (password, salt, callback)->
	return crypto.pbkdf2(password, salt, 10000, 64, callback)

class AccessTokenEncryptor

	constructor: (settings) ->

		@settings = settings
		@cipherLabel = @settings.cipherLabel
		throw Error("cipherLabel must not contain a colon (:)") if @cipherLabel?.match(/:/)

		@cipherPassword = @settings.cipherPasswords[@cipherLabel]
		throw Error("cipherPassword not set") if not @cipherPassword?
		throw Error("cipherPassword too short") if @cipherPassword.length < 16

	encryptJson: (json, callback) ->
		string = JSON.stringify(json)
		salt = crypto.randomBytes(16)
		keyFn @cipherPassword, salt, (err, key) =>
			if err?
				logger.err err:err, "error getting Fn key"
				return callback(err)
			cipher = crypto.createCipher(ALGORITHM,  key)
			crypted  = cipher.update(string, 'utf8', 'base64') + cipher.final('base64')
			callback(null, @cipherLabel + ":" + salt.toString('hex') + ":" + crypted)

	decryptToJson: (encryptedJson, callback) ->
		[label, salt, cipherText] = encryptedJson.split(':', 3)
		password = @settings.cipherPasswords[label]
		return callback(new Error("invalid password")) if not password? or password.length < 16
		keyFn password, new Buffer(salt, 'hex'), (err, key) =>
			if err?
				logger.err err:err, "error getting Fn key"
				return callback(err)
			decipher = crypto.createDecipher(ALGORITHM, key)
			dec = decipher.update(cipherText, 'base64', 'utf8') + decipher.final('utf8')
			try
				json = JSON.parse(dec)
			catch e
				return callback(new Error("error decrypting token"))
			callback(null, json)

module.exports = AccessTokenEncryptor
