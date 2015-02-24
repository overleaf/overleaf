fs = require "fs"
Path = require "path"
spawn = require("child_process").spawn
logger = require "logger-sharelatex"

module.exports = OutputFileOptimiser =

	optimiseFile: (src, dst, callback = (error) ->) ->
		if src.match(/\.pdf$/)
			OutputFileOptimiser.optimisePDF src, dst, callback
		else
			callback (null)

	optimisePDF: (src, dst, callback = (error) ->) ->
		tmpOutput = dst + '.opt'
		args = ["--linearize", src, tmpOutput]
		logger.log args: args, "running qpdf command"

		proc = spawn("qpdf", args)
		stdout = ""
		proc.stdout.on "data", (chunk) ->
			stdout += chunk.toString()	
		proc.on "error", callback	
		proc.on "close", (code) ->
			if code != 0
				logger.warn {directory, code}, "qpdf returned error"
				return callback null
			fs.rename tmpOutput, dst, (err) ->
				# could log an error here
				callback null
