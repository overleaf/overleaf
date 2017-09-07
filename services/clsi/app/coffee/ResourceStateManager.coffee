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
	# compile, along with the list of resources..
	#
	# Subsequent incremental compiles must come with the same value - if
	# not they will be rejected with a 409 Conflict response. The
	# previous list of resources is returned.
	#
	# An incremental compile can only update existing files with new
	# content.  The sync state identifier must change if any docs or
	# files are moved, added, deleted or renamed.

	SYNC_STATE_FILE: ".project-sync-state"

	saveProjectStateHash: (state, resources, basePath, callback = (error) ->) ->
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
			resourceList = (resource.path for resource in resources)
			fs.writeFile stateFile, [resourceList..., "stateHash:#{state}"].join("\n"), callback

	checkProjectStateHashMatches: (state, basePath, callback = (error, resources) ->) ->
		stateFile = Path.join(basePath, @SYNC_STATE_FILE)
		SafeReader.readFile stateFile, 128*1024, 'utf8', (err, result) ->
			return callback(err) if err?
			[resourceList..., oldState] = result?.toString()?.split("\n") or []
			newState = "stateHash:#{state}"
			logger.log state:state, oldState: oldState, basePath:basePath, stateMatches: (newState is oldState), "checking sync state"
			if newState isnt oldState
				return callback new Errors.FilesOutOfSyncError("invalid state for incremental update")
			else
				resources = ({path: path} for path in resourceList)
				callback(null, resources)
