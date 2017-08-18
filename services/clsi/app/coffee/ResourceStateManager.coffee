Path = require "path"
fs = require "fs"
logger = require "logger-sharelatex"
settings = require("settings-sharelatex")
Errors = require "./Errors"
SafeReader = require "./SafeReader"

module.exports = ResourceStateManager =

	# The sync state is an identifier which must match for an
	# incremental update to be allowed.
	#
	# The initial value is passed in and stored on a full
	# compile.
	#
	# Subsequent incremental compiles must come with the same value - if
	# not they will be rejected with a 409 Conflict response.
	#
	# An incremental compile can only update existing files with new
	# content.  The sync state identifier must change if any docs or
	# files are moved, added, deleted or renamed.

	SYNC_STATE_FILE: ".project-sync-state"

	saveProjectStateHash: (state, basePath, callback) ->
		stateFile = Path.join(basePath, @SYNC_STATE_FILE)
		if not state? # remove the file if no state passed in
			logger.log state:state, basePath:basePath, "clearing sync state"
			fs.unlink stateFile, (err) ->
				if err? and err.code isnt 'ENOENT'
					return callback(err)
				else
					return callback()
		else
			logger.log state:state, basePath:basePath, "writing sync state"
			fs.writeFile stateFile, state, {encoding: 'ascii'}, callback

	checkProjectStateHashMatches: (state, basePath, callback) ->
		stateFile = Path.join(basePath, @SYNC_STATE_FILE)
		SafeReader.readFile stateFile, 64, 'ascii', (err, oldState) ->
			return callback(err) if err?
			if state isnt oldState
				return callback new Errors.FilesOutOfSyncError("invalid state for incremental update")
			else
				callback(null)
