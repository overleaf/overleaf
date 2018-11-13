fs = require("fs")
uuid = require('node-uuid')
path = require("path")
_ = require("underscore")
logger = require("logger-sharelatex")
metrics = require("metrics-sharelatex")
Settings = require("settings-sharelatex")
Errors = require "./Errors"

module.exports = 

	writeStream: (stream, key, callback)->
		timer = new metrics.Timer("writingFile")
		callback = _.once callback
		fsPath = @_getPath(key)
		logger.log fsPath:fsPath, "writing file locally"
		writeStream = fs.createWriteStream(fsPath)
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
		stream.pipe writeStream

	getStream: (fsPath, _callback = (err, res)->) ->
		callback = _.once _callback
		timer = new metrics.Timer("readingFile")
		logger.log fsPath:fsPath, "reading file locally"
		readStream = fs.createReadStream(fsPath)
		readStream.on "end", ->
			timer.done()
			logger.log fsPath:fsPath, "finished reading file locally"
		readStream.on "error", (err)->
			logger.err err:err, fsPath:fsPath, "problem reading file locally, with read stream"
			if err.code == 'ENOENT'
				callback new Errors.NotFoundError(err.message), null
			else
				callback err
		callback null, readStream

	deleteFile: (fsPath, callback)->
		if !fsPath? or fsPath == ""
			return callback()
		logger.log fsPath:fsPath, "removing local temp file"
		fs.unlink fsPath, callback

	_getPath : (key)->
		if !key?
			key = uuid.v1()
		key = key.replace(/\//g,"-")
		console.log Settings.path.uploadFolder, key
		path.join(Settings.path.uploadFolder, key)
