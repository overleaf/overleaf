easyimage = require("easyimage")
_ = require("underscore")
metrics = require("./metrics")
logger = require("logger-sharelatex")
exec = require('child_process').exec
approvedFormats = ["png"]

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
		exec args, (err, stdout, stderr)->
			timer.done()
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
		args = "nice convert -flatten -background white -resize 300x -density 300 #{sourcePath} #{destPath}"
		exec args, (err, stdout, stderr)->
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
		args = "nice convert -flatten -background white -resize 600x -density 300 #{sourcePath} #{destPath}"
		exec args, (err, stdout, stderr)->
			callback(err, destPath)
