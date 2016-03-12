settings = require("settings-sharelatex")
PersistorManager = require("./PersistorManager")
logger = require("logger-sharelatex")
async = require("async")

module.exports =

	getSize: (bucket, project_id, callback)->
		logger.log bucket:bucket, project_id:project_id, "getting project size"
		PersistorManager.getProjectSize bucket, project_id, (err, size)->
			if err?
				logger.err  bucket:bucket, project_id:project_id, "error getting size"
			callback err, size