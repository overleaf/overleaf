Settings = require "settings-sharelatex"
RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("clsi_state")
logger = require "logger-sharelatex"
crypto = require "crypto"

buildKey = (project_id, user_id)->
	return "clsistate:#{project_id}-#{user_id}"  # FIXME: should we cluster these on project??

buildState = (project) ->
	JSON.stringify project

clsiStateEnabled = Settings.clsiState

OneHour = 3600 * 1000

module.exports = ClsiStateManager =

	checkState: (project_id, user_id, project, callback = (err, ok) ->) ->
		newState = buildState(project)
		@getState project_id, user_id, (err, oldState) ->
			return callback(err) if err?
			if newState is oldState
				hash = crypto.createHash('sha1').update(newState, 'utf8').digest('hex')
				callback(null,true,hash)
			else
				callback(null,false)

	getState: (project_id, user_id, callback = (err, state)->)->
		rclient.get buildKey(project_id, user_id), (err, state)->
			return callback(err) if err?
			logger.log project_id: project_id, user_id: user_id, state: state, "got project state from redis"
			return callback(null, state)

	setState: (project_id, user_id, project, callback = (err)->)->
		projectState = buildState project
		logger.log project_id: project_id, user_id: user_id, projectState: projectState, "setting project state in redis"
		rclient.set buildKey(project_id, user_id), projectState, "PX", OneHour, (err) ->
			return callback(err) if err?
			hash = crypto.createHash('sha1').update(projectState, 'utf8').digest('hex')
			callback(null,hash)
