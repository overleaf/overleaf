ProjectDetailsHandler = require("./ProjectDetailsHandler")
Errors = require("../Errors/Errors")
logger = require("logger-sharelatex")


module.exports = 

	getProjectDetails : (req, res)->
		{project_id} = req.params
		ProjectDetailsHandler.getDetails project_id, (err, projDetails)->
			if err? and err instanceof Errors.NotFoundError
				return res.sendStatus 404
			else if err?
				logger.log err:err, project_id:project_id, "something went wrong getting project details"
				return res.sendStatus 500
			else
				res.json(projDetails)

