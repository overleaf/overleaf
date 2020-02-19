spawn = require("child_process").spawn
logger = require "logger-sharelatex"

logger.info "using standard command runner"

module.exports = CommandRunner =
	run: (project_id, command, directory, image, timeout, environment, callback = (error) ->) ->
		command = (arg.toString().replace('$COMPILE_DIR', directory) for arg in command)
		logger.log project_id: project_id, command: command, directory: directory, "running command"
		logger.warn "timeouts and sandboxing are not enabled with CommandRunner"

		# merge environment settings
		env = {}
		env[key] = value for key, value of process.env
		env[key] = value for key, value of environment

		# run command as detached process so it has its own process group (which can be killed if needed)
		proc = spawn command[0], command.slice(1), cwd: directory, env: env

		stdout = ""
		proc.stdout.on "data", (data)->
			stdout += data

		proc.on "error", (err)->
			logger.err err:err, project_id:project_id, command: command, directory: directory, "error running command"
			callback(err)

		proc.on "close", (code, signal) ->
			logger.info code:code, signal:signal, project_id:project_id, "command exited"
			if signal is 'SIGTERM' # signal from kill method below
				err = new Error("terminated")
				err.terminated = true
				return callback(err)
			else if code is 1 # exit status from chktex
				err = new Error("exited")
				err.code = code
				return callback(err)
			else
				callback(null, {"stdout": stdout})

		return proc.pid # return process id to allow job to be killed if necessary

	kill: (pid, callback = (error) ->) ->
		try
			process.kill -pid # kill all processes in group
		catch err
			return callback(err)
		callback()
