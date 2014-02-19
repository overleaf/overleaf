exec = require('child_process').exec
logger = require("logger-sharelatex")


module.exports = 

	compressPng: (localPath, callback)->
		startTime = new Date()
		logger.log localPath:localPath, "optimising png path"
		args = "optipng #{localPath}"
		opts =
			timeout: 60 * 1000
		exec args, opts, callback
			

