exec = require('child_process').exec
logger = require("logger-sharelatex")
Settings = require "settings-sharelatex"

module.exports = 

	compressPng: (localPath, callback)->
		startTime = new Date()
		logger.log localPath:localPath, "optimising png path"
		args = "optipng #{localPath}"
		opts =
			timeout: 30 * 1000
			killSignal: "SIGKILL"
		if !Settings.enableConversions
			error = new Error("Image conversions are disabled")
			return callback(error)
		exec args, opts,(err, stdout, stderr)->
			if err? and err.signal == 'SIGKILL'
				logger.warn {err: err, stderr: stderr, localPath: localPath}, "optimiser timeout reached"
				err = null
			else if err?
				logger.err err:err, stderr:stderr, localPath:localPath, "something went wrong converting compressPng"
			else
				logger.log  localPath:localPath, "finished compressPng file"
			callback(err)
