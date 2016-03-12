settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
metrics = require("metrics-sharelatex")
Errors = require('./Errors')


module.exports = projectController =

	projectSize: (req, res)->
		metrics.inc "projectSize"
		{project_id, bucket} = req
		logger.log project_id:project_id, bucket:bucket, "reciving request to project size"
		FileHandler.getFile bucket, project_id, req, (err)->
			if err?
				logger.log err: err, project_id: project_id, bucket: bucket, "error inserting file"
				res.send 500
			else
				res.send 200