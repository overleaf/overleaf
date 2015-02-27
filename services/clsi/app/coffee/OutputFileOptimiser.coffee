fs = require "fs"
Path = require "path"
spawn = require("child_process").spawn
logger = require "logger-sharelatex"
_ = require "underscore"

module.exports = OutputFileOptimiser =

	optimiseFile: (src, dst, callback = (error) ->) ->
		# check output file (src) and see if we can optimise it, storing
		# the result in the build directory (dst)
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
		callback = _.once(callback) # avoid double call back for error and close event
		proc.on "error", (err) ->
			logger.warn {err, args}, "qpdf failed"
			callback(null) # ignore the error
		proc.on "close", (code) ->
			if code != 0
				logger.warn {code, args}, "qpdf returned error"
				return callback(null) # ignore the error
			fs.rename tmpOutput, dst, (err) ->
				if err?
					logger.warn {tmpOutput, dst}, "failed to rename output of qpdf command"
				callback(null) # ignore the error
