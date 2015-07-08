ProjectDetailsHandler = require("./ProjectDetailsHandler")
logger = require("logger-sharelatex")


module.exports = 

	getProjectDetails : (req, res)->
		{project_id} = req.params
		ProjectDetailsHandler.getDetails project_id, (err, projDetails)->
			if err?
				logger.log err:err, project_id:project_id, "something went wrong getting project details"
				return res.send 500
			res.json(projDetails)

