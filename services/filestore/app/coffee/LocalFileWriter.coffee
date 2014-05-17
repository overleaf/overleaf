fs = require("fs")
uuid = require('node-uuid')
path = require("path")
_ = require("underscore")
logger = require("logger-sharelatex")
metrics = require("metrics-sharelatex")
Settings = require("settings-sharelatex")

module.exports = 

	writeStream: (stream, key, callback)->
		timer = new metrics.Timer("writingFile")
		callback = _.once callback
		fsPath = @_getPath(key)
		logger.log fsPath:fsPath, "writing file locally"
		writeStream = fs.createWriteStream(fsPath)
		stream.pipe writeStream
		writeStream.on "finish", ->
			timer.done()
			logger.log fsPath:fsPath, "finished writing file locally"
			callback(null, fsPath)
		writeStream.on "error", (err)->
			logger.err err:err, fsPath:fsPath, "problem writing file locally, with write stream"
			callback err
		stream.on "error", (err)->
			logger.log err:err, fsPath:fsPath, "problem writing file locally, with read stream"
			callback err

	deleteFile: (fsPath, callback)->
		logger.log fsPath:fsPath, "removing local temp file"
		fs.unlink fsPath, callback

	_getPath : (key)->
		if !key?
			key = uuid.v1()
		key = key.replace(/\//g,"-")
		path.join(Settings.path.uploadFolder, key)
