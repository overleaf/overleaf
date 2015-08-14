InactiveProjectManager = require("./InactiveProjectManager")
logger = require("logger-sharelatex")


module.exports = 

	deactivateOldProjects: (req, res)->
		logger.log "recived request to deactivate old projects"
		InactiveProjectManager.deactivateOldProjects 10, (err)->
			if err?
				res.sendStatus(500)
			else
				res.sendStatus(200)


	deactivateProject: (req, res)->
		project_id = req.params.project_id
		logger.log project_id:project_id, "recived request to deactivating project"
		InactiveProjectManager.deactivateProject project_id, (err)->
			if err?
				res.sendStatus 500
			else
				res.sendStatus 200