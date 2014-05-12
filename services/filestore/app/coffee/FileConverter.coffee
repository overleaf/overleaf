_ = require("underscore")
metrics = require("metrics-sharelatex")
logger = require("logger-sharelatex")
exec = require('child_process').exec
approvedFormats = ["png"]

fourtySeconds = 40 * 1000

childProcessOpts =
	killSignal: "SIGKILL"
	timeout: fourtySeconds


module.exports =

	convert: (sourcePath, requestedFormat, callback)->
		logger.log sourcePath:sourcePath, requestedFormat:requestedFormat, "converting file format"
		timer = new metrics.Timer("imageConvert")
		destPath = "#{sourcePath}.#{requestedFormat}"
		sourcePath = "#{sourcePath}[0]"
		if !_.include approvedFormats, requestedFormat
			err = new Error("invalid format requested")
			return callback err
		width = "600x"
		args = "nice convert -define pdf:fit-page=#{width} -flatten -density 300 #{sourcePath} #{destPath}"
		console.log args
		exec args, childProcessOpts, (err, stdout, stderr)->
			timer.done()
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, requestedFormat:requestedFormat, destPath:destPath,  "something went wrong converting file"
			else
				logger.log  sourcePath:sourcePath, requestedFormat:requestedFormat, destPath:destPath,  "finished converting file"
			callback(err, destPath)

	thumbnail: (sourcePath, callback)->
		logger.log sourcePath:sourcePath, "thumbnail convert file"
		destPath = "#{sourcePath}.png"
		sourcePath = "#{sourcePath}[0]"
		width = "260x"
		args = "nice convert -flatten -background white -density 300 -define pdf:fit-page=#{width} #{sourcePath} -resize #{width} #{destPath}"
		exec args, childProcessOpts, (err, stdout, stderr)->
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, "something went wrong converting file to preview"
			else
				logger.log  sourcePath:sourcePath, destPath:destPath, "finished thumbnailing file"
			callback(err, destPath)	

	preview: (sourcePath, callback)->
		logger.log sourcePath:sourcePath, "preview convert file"
		destPath = "#{sourcePath}.png"
		sourcePath = "#{sourcePath}[0]"
		width = "548x"
		args = "nice convert -flatten -background white -density 300 -define pdf:fit-page=#{width} #{sourcePath} -resize #{width} #{destPath}"
		exec args, childProcessOpts, (err, stdout, stderr)->
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, destPath:destPath, "something went wrong converting file to preview"
			else
				logger.log  sourcePath:sourcePath, destPath:destPath, "finished converting file to preview"
			callback(err, destPath)
