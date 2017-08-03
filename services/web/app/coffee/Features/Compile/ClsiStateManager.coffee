Settings = require "settings-sharelatex"
RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("clsi_state")
logger = require "logger-sharelatex"
crypto = require "crypto"

buildKey = (project_id)->
	return "clsistate:#{project_id}"  # FIXME: should we cluster these on project??

# The "state" of a project is a hash of the relevant attributes in the
# project object in this case we only need the rootFolder.
#
# The idea is that it will change if any doc or file is
# created/renamed/deleted, and also if the content of any file (not
# doc) changes.
#
# When the hash changes the full set of files on the CLSI will need to
# be updated.  If it doesn't change then we can overwrite changed docs
# in place on the clsi, getting them from the docupdater.
#
# The docupdater is also responsible for unsetting the key in redis if
# it removes any documents from the doc updater.

buildState = (project) ->
	json = JSON.stringify(project.rootFolder)
	return crypto.createHash('sha1').update(json, 'utf8').digest('hex')

clsiStateEnabled = Settings.clsiState

OneHour = 3600 * 1000

module.exports = ClsiStateManager =

	checkProjectStateMatch: (project_id, project, callback = (err, ok) ->) ->
		newState = buildState(project)
		rclient.get buildKey(project_id), (err, oldState) ->
			return callback(err) if err?
			logger.log project_id: project_id, new_state: newState, old_state: oldState, "got project state from redis"
			if newState is oldState
				callback(null,true,oldState)
			else
				callback(null,false)

	setProjectState: (project_id, project, callback = (err)->)->
		projectState = buildState(project)
		logger.log project_id: project_id, projectState: projectState, "setting project state in redis"
		rclient.set buildKey(project_id), projectState, "PX", OneHour, (err) ->
			return callback(err) if err?
			callback(null,projectState)
