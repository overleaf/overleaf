fs = require "fs"
Path = require "path"
spawn = require("child_process").spawn
logger = require "logger-sharelatex"

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
		proc.on "error", callback
		proc.on "close", (code) ->
			if code != 0
				logger.warn {directory, code}, "qpdf returned error"
				return callback null
			fs.rename tmpOutput, dst, (err) ->
				if err?
					logger.warn {tmpOutput, dst}, "failed to rename output of qpdf command"
				callback err
