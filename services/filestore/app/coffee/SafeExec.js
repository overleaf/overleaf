/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require("underscore");
const logger = require("logger-sharelatex");
const child_process = require('child_process');
const Settings = require("settings-sharelatex");

// execute a command in the same way as 'exec' but with a timeout that
// kills all child processes
//
// we spawn the command with 'detached:true' to make a new process
// group, then we can kill everything in that process group.

module.exports = function(command, options, callback) {
	if (callback == null) { callback = function(err, stdout, stderr) {}; }
	if (!Settings.enableConversions) {
		const error = new Error("Image conversions are disabled");
		return callback(error);
	}

	// options are {timeout:  number-of-milliseconds, killSignal: signal-name}
	const [cmd, ...args] = Array.from(command);

	const child = child_process.spawn(cmd, args, {detached:true});
	let stdout = "";
	let stderr = "";

	const cleanup = _.once(function(err) {
		if (killTimer != null) { clearTimeout(killTimer); }
		return callback(err, stdout, stderr);
	});

	if (options.timeout != null) {
		var killTimer = setTimeout(function() {
			try {
				// use negative process id to kill process group
				return process.kill(-child.pid, options.killSignal || "SIGTERM");
			} catch (error) {
				return logger.log({process: child.pid, kill_error: error}, "error killing process");
			}
		}
		, options.timeout);
	}

	child.on('close', function(code, signal) {
		const err = code ? new Error(`exit status ${code}`) : signal;
		return cleanup(err);
	});

	child.on('error', err => cleanup(err));

	child.stdout.on('data', chunk => stdout += chunk);

	return child.stderr.on('data', chunk => stderr += chunk);
};
