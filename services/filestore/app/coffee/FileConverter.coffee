_ = require("underscore")
metrics = require("./metrics")
logger = require("logger-sharelatex")
exec = require('child_process').exec
approvedFormats = ["png"]

twoMinsInMs = 2 * (60 * 1000)

module.exports =

	convert: (sourcePath, requestedFormat, callback)->
		logger.log sourcePath:sourcePath, requestedFormat:requestedFormat, "converting file format"
		timer = new metrics.Timer("imageConvert")
		destPath = "#{sourcePath}.#{requestedFormat}"
		sourcePath = "#{sourcePath}[0]"
		if !_.include approvedFormats, requestedFormat
			err = new Error("invalid format requested")
			return callback err
		args = "nice convert -flatten -density 300 #{sourcePath} #{destPath}"
		opts =
			timeout: twoMinsInMs
		exec args, opts, (err, stdout, stderr)->
			timer.done()
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, requestedFormat:requestedFormat, "something went wrong converting file"
			else
				logger.log  sourcePath:sourcePath, requestedFormat:requestedFormat, "finished converting file"
			callback(err, destPath)

	thumbnail: (sourcePath, callback)->
		logger.log sourcePath:sourcePath, "thumbnail convert file"
		destPath = "#{sourcePath}.png"
		sourcePath = "#{sourcePath}[0]"
		args =
			src: sourcePath
			dst: destPath
			width: 424
			height: 300
		args = "nice convert -flatten -background white -resize 260x -density 300 #{sourcePath} #{destPath}"
		opts =
			timeout: twoMinsInMs
		exec args, opts,(err, stdout, stderr)->
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, "something went wrong converting file to preview"
			else
				logger.log  sourcePath:sourcePath, "finished thumbnailing file"
			callback(err, destPath)	

	preview: (sourcePath, callback)->
		logger.log sourcePath:sourcePath, "preview convert file"
		destPath = "#{sourcePath}.png"
		sourcePath = "#{sourcePath}[0]"
		args =
			src: sourcePath
			dst: destPath
			width: 600
			height: 849
		args = "nice convert -flatten -background white -resize 548x -density 300 #{sourcePath} #{destPath}"
		opts =
			timeout: twoMinsInMs
		exec args, opts,(err, stdout, stderr)->
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, "something went wrong converting file to preview"
			else
				logger.log  sourcePath:sourcePath, "finished converting file to preview"
			callback(err, destPath)
