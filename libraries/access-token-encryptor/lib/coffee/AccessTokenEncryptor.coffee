crypto = require('crypto')

ALGORITHM = 'aes-256-ctr'

keyFn = (password, salt, callback)->
	return crypto.pbkdf2(password, salt, 10000, 64, 'sha1', callback)

keyFn32 = (password, salt, keyLength, callback)->
	return crypto.pbkdf2(password, salt, 10000, 32, 'sha1', callback)

class AccessTokenEncryptor

	constructor: (settings) ->

		@settings = settings
		@cipherLabel = @settings.cipherLabel
		throw Error("cipherLabel must not contain a colon (:)") if @cipherLabel?.match(/:/)

		@cipherPassword = @settings.cipherPasswords[@cipherLabel]
		throw Error("cipherPassword not set") if not @cipherPassword?
		throw Error("cipherPassword too short") if @cipherPassword.length < 16

	encryptJson: (json, callback) ->
		unless ["2015.1", "2016.1"].includes(@cipherLabel)
			return @encryptJsonV2(json, callback)

		string = JSON.stringify(json)
		salt = crypto.randomBytes(16)
		keyFn @cipherPassword, salt, (err, key) =>
			if err?
				logger.err err:err, "error getting Fn key"
				return callback(err)
			cipher = crypto.createCipher(ALGORITHM,  key)
			crypted  = cipher.update(string, 'utf8', 'base64') + cipher.final('base64')
			callback(null, @cipherLabel + ":" + salt.toString('hex') + ":" + crypted)

	encryptJsonV2: (json, callback) ->
		string = JSON.stringify(json)
		crypto.randomBytes 32, (err, bytes) =>
			return callback(err) if err
			salt = bytes.slice(0, 16)
			iv = bytes.slice(16, 32)

			keyFn32 @cipherPassword, salt, 32, (err, key) =>
				if err?
					logger.err err:err, "error getting Fn key"
					return callback(err)

				cipher = crypto.createCipheriv(ALGORITHM, key, iv)
				crypted = cipher.update(string, 'utf8', 'base64') + cipher.final('base64')

				callback(null, "#{@cipherLabel}:#{salt.toString('hex')}:#{crypted}:#{iv.toString('hex')}")

	decryptToJson: (encryptedJson, callback) ->
		[label, salt, cipherText, iv] = encryptedJson.split(':', 4)
		if iv and iv.length > 0
			return @decryptToJsonV2(encryptedJson, callback)

		password = @settings.cipherPasswords[label]
		return callback(new Error("invalid password")) if not password? or password.length < 16
		keyFn password, Buffer.from(salt, 'hex'), (err, key) =>
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

	decryptToJsonV2: (encryptedJson, callback) ->
		[label, salt, cipherText, iv] = encryptedJson.split(':', 4)
		password = @settings.cipherPasswords[label]
		return callback(new Error("invalid password")) if not password? or password.length < 16

		keyFn32 password, Buffer.from(salt, 'hex'), 32, (err, key) =>
			if err?
				logger.err err:err, "error getting Fn key"
				return callback(err)

			decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
			dec = decipher.update(cipherText, 'base64', 'utf8') + decipher.final('utf8')
			try
				json = JSON.parse(dec)
			catch e
				return callback(new Error("error decrypting token"))
			callback(null, json)

module.exports = AccessTokenEncryptor
