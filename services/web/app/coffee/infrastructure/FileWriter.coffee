fs = require 'fs'
logger = require 'logger-sharelatex'
uuid = require 'uuid'
_ = require 'underscore'
Settings = require 'settings-sharelatex'

module.exports = 
	writeStreamToDisk: (identifier, stream, callback = (error, fsPath) ->) ->
		callback = _.once(callback)
		fsPath = "#{Settings.path.dumpFolder}/#{identifier}_#{uuid.v4()}"

		writeStream = fs.createWriteStream(fsPath)
		stream.pipe(writeStream)

		stream.on 'error', (err)->
			logger.err {err, identifier, fsPath},	"[writeStreamToDisk] something went wrong with incoming stream"
			callback(err)
		writeStream.on 'error', (err)->
			logger.err {err, identifier, fsPath},	"[writeStreamToDisk] something went wrong with writing to disk"
			callback(err)
		writeStream.on "finish", ->
			logger.log {identifier, fsPath}, "[writeStreamToDisk] write stream finished"
			callback null, fsPath