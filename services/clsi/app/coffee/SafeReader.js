fs = require "fs"
logger = require "logger-sharelatex"

module.exports = SafeReader =

	# safely read up to size bytes from a file and return result as a
	# string

	readFile: (file, size, encoding, callback = (error, result) ->) ->
		fs.open file, 'r', (err, fd) ->
			return callback() if err? and err.code is 'ENOENT'
			return callback(err) if err?

			# safely return always closing the file
			callbackWithClose = (err, result...) ->
				fs.close fd, (err1) ->
					return callback(err) if err?
					return callback(err1) if err1?
					callback(null, result...)

			buff = new Buffer(size, 0) # fill with zeros
			fs.read fd, buff, 0, buff.length, 0, (err, bytesRead, buffer) ->
				return callbackWithClose(err) if err?
				result = buffer.toString(encoding, 0, bytesRead)
				callbackWithClose(null, result, bytesRead)
