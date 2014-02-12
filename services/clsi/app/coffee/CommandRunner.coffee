spawn = require("child_process").spawn
logger = require "logger-sharelatex"

module.exports = CommandRunner =
	run: (project_id, command, directory, timeout, callback = (error) ->) ->
		command = (arg.replace('$COMPILE_DIR', directory) for arg in command)
		logger.log project_id: project_id, command: command, directory: directory, "running command"
		logger.warn "timeouts and sandboxing are not enabled with CommandRunner"

		proc = spawn command[0], command.slice(1), stdio: "inherit", cwd: directory
		proc.on "close", () ->
			callback()