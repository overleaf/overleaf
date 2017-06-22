exec = require('child_process').exec
logger = require("logger-sharelatex")

module.exports = 

	compressPng: (localPath, callback)->
		startTime = new Date()
		logger.log localPath:localPath, "optimising png path"
		args = "optipng #{localPath}"
		opts =
			timeout: 30 * 1000
			killSignal: "SIGKILL"
		exec args, opts,(err, stdout, stderr)->
			if err?
				if err.signal == 'SIGKILL'
					logger.warn {err: err, stderr: stderr, localPath: localPath}, "optimiser timeout reached"
					err = null
				else
					logger.err err:err, stderr:stderr, localPath:localPath, "something went wrong converting compressPng"
			else
				logger.log  localPath:localPath, "finished compressPng file"
			callback(err)

