_ = require("underscore")
logger = require("logger-sharelatex")
child_process = require('child_process')
Settings = require "settings-sharelatex"

# execute a command in the same way as 'exec' but with a timeout that
# kills all child processes
#
# we spawn the command with 'detached:true' to make a new process
# group, then we can kill everything in that process group.

module.exports = (command, options, callback = (err, stdout, stderr) ->) ->
	if !Settings.enableConversions
		error = new Error("Image conversions are disabled")
		return callback(error)

	# options are {timeout:  number-of-milliseconds, killSignal: signal-name}
	[cmd, args...] = command

	child = child_process.spawn cmd, args, {detached:true}
	stdout = ""
	stderr = ""

	cleanup = _.once (err) ->
		clearTimeout killTimer if killTimer?
		callback err, stdout, stderr

	if options.timeout?
		killTimer = setTimeout () ->
			try
				# use negative process id to kill process group
				process.kill -child.pid, options.killSignal || "SIGTERM"
			catch error
				logger.log process: child.pid, kill_error: error, "error killing process"
		, options.timeout

	child.on 'close', (code, signal) ->
		err = if code then new Error("exit status #{code}") else signal
		cleanup err

	child.on 'error', (err) ->
		cleanup err

	child.stdout.on 'data', (chunk) ->
		stdout += chunk

	child.stderr.on 'data', (chunk) ->
		stderr += chunk
