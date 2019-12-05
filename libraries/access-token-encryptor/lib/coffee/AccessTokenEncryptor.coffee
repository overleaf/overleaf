crypto = require('crypto')
async = require('async')

ALGORITHM = 'aes-256-ctr'

keyFn = (password, salt, keyLength, callback)->
	return crypto.pbkdf2(password, salt, 10000, keyLength, 'sha1', callback)

class AccessTokenEncryptor

	constructor: (settings) ->

		@settings = settings
		@cipherLabel = "2019.1"

		@cipherPassword = @settings.cipherPasswords[@cipherLabel]
		throw Error("cipherPassword not set") if not @cipherPassword?
		throw Error("cipherPassword too short") if @cipherPassword.length < 16

	encryptJson: (json, callback) ->
		string = JSON.stringify(json)
		async.parallel [
			(cb) -> crypto.randomBytes(16, cb)
			(cb) -> crypto.randomBytes(16, cb)
		], (err, results) =>
			if err?
				return callback(err)

			salt = results[0]
			iv = results[1]

			keyFn @cipherPassword, salt, 32, (err, key) =>
				if err?
					logger.err err:err, "error getting Fn key"
					return callback(err)

				cipher = crypto.createCipheriv(ALGORITHM, key, iv)
				crypted = cipher.update(string, 'utf8', 'base64') + cipher.final('base64')

				callback(null, "#{@cipherLabel}:#{salt.toString('hex')}:#{crypted}:#{iv.toString('hex')}")

	decryptToJson: (encryptedJson, callback) ->
		[label, salt, cipherText, iv] = encryptedJson.split(':', 4)

		password = @settings.cipherPasswords[label]
		return callback(new Error("invalid password")) if not password? or password.length < 16

		keyLength = if label == "2019.1" then 32 else 64
		keyFn password, Buffer.from(salt, 'hex'), keyLength, (err, key) =>
			if err?
				logger.err err:err, "error getting Fn key"
				return callback(err)

			decipher = if label == "2019.1"
				crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
			else
				crypto.createDecipher(ALGORITHM, key)

			dec = decipher.update(cipherText, 'base64', 'utf8') + decipher.final('utf8')
			try
				json = JSON.parse(dec)
			catch e
				return callback(new Error("error decrypting token"))
			callback(null, json)

module.exports = AccessTokenEncryptor
