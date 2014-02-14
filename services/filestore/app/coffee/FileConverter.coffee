easyimage = require("easyimage")
_ = require("underscore")
metrics = require("./metrics")
logger = require("logger-sharelatex")

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
		args = 
			src: sourcePath
			dst: destPath
		easyimage.convert args, (err)->
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
		args = "convert -flatten -background white -resize 300x -density 300 #{sourcePath} #{destPath}"
		easyimage.exec args, (err)->
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
		args = "convert -flatten -background white -resize 600x -density 300 #{sourcePath} #{destPath}"
		easyimage.exec args, (err)->
			callback(err, destPath)
