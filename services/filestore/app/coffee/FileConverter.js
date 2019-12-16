_ = require("underscore")
metrics = require("metrics-sharelatex")
logger = require("logger-sharelatex")
safe_exec = require("./SafeExec")
approvedFormats = ["png"]
Settings = require "settings-sharelatex"

fourtySeconds = 40 * 1000

childProcessOpts =
	killSignal: "SIGTERM"
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
		command = ["convert", "-define", "pdf:fit-page=#{width}", "-flatten", "-density", "300", sourcePath, destPath]
		command = Settings.commands.convertCommandPrefix.concat(command)
		safe_exec command, childProcessOpts, (err, stdout, stderr)->
			timer.done()
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, requestedFormat:requestedFormat, destPath:destPath,  "something went wrong converting file"
			else
				logger.log  sourcePath:sourcePath, requestedFormat:requestedFormat, destPath:destPath,  "finished converting file"
			callback(err, destPath)

	thumbnail: (sourcePath, callback)->
		destPath = "#{sourcePath}.png"
		sourcePath = "#{sourcePath}[0]"
		width = "260x"
		command = ["convert", "-flatten", "-background", "white", "-density", "300", "-define", "pdf:fit-page=#{width}", sourcePath, "-resize", width, destPath]
		logger.log sourcePath:sourcePath, destPath:destPath,  command:command, "thumbnail convert file"
		command = Settings.commands.convertCommandPrefix.concat(command)
		safe_exec command, childProcessOpts, (err, stdout, stderr)->
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, "something went wrong converting file to thumbnail"
			else
				logger.log  sourcePath:sourcePath, destPath:destPath, "finished thumbnailing file"
			callback(err, destPath)	

	preview: (sourcePath, callback)->
		logger.log sourcePath:sourcePath, "preview convert file"
		destPath = "#{sourcePath}.png"
		sourcePath = "#{sourcePath}[0]"
		width = "548x"
		command = ["convert", "-flatten", "-background", "white", "-density", "300", "-define", "pdf:fit-page=#{width}", sourcePath, "-resize", width, destPath]
		command = Settings.commands.convertCommandPrefix.concat(command)
		safe_exec command, childProcessOpts, (err, stdout, stderr)->
			if err?
				logger.err err:err, stderr:stderr, sourcePath:sourcePath, destPath:destPath, "something went wrong converting file to preview"
			else
				logger.log  sourcePath:sourcePath, destPath:destPath, "finished converting file to preview"
			callback(err, destPath)
