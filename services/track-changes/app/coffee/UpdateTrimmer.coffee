MongoManager = require "./MongoManager"
WebApiManager = require "./WebApiManager"
logger = require "logger-sharelatex"

module.exports = UpdateTrimmer =
	shouldTrimUpdates: (project_id, callback = (error, shouldTrim) ->) ->
		MongoManager.getProjectMetaData project_id, (error, metadata) ->
			return callback(error) if error?
			if metadata?.preserveHistory
				return callback null, false
			else
				WebApiManager.getProjectDetails project_id, (error, details) ->
					return callback(error) if error?
					logger.log project_id: project_id, details: details, "got details"
					if details?.features?.versioning
						MongoManager.setProjectMetaData project_id, preserveHistory: true, (error) ->
							return callback(error) if error?
							MongoManager.upgradeHistory project_id, (error) ->
								return callback(error) if error?
								callback null, false
					else
						callback null, true

