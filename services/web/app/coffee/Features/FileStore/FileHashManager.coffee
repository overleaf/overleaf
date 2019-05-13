crypto = require "crypto"
logger = require("logger-sharelatex")
fs = require("fs")
_ = require("underscore")

module.exports = FileHashManager =

	computeHash: (filePath, callback = (error, hashValue) ->) ->
		callback = _.once(callback) # avoid double callbacks

		# taken from v1/history/storage/lib/blob_hash.js
		getGitBlobHeader = (byteLength) ->
			return 'blob ' + byteLength + '\x00'

		getByteLengthOfFile = (cb) ->
			fs.stat filePath, (err, stats) ->
				return cb(err) if err?
				cb(null, stats.size)

		getByteLengthOfFile (err, byteLength) ->
			return callback(err) if err?

			input = fs.createReadStream(filePath)
			input.on 'error', (err) ->
				logger.err {filePath: filePath, err:err}, "error opening file in computeHash"
				return callback(err)

			hash = crypto.createHash("sha1")
			hash.setEncoding('hex')
			hash.update(getGitBlobHeader(byteLength))
			hash.on 'readable', () ->
				result = hash.read()
				if result?
					callback(null, result.toString('hex'))
			input.pipe(hash)