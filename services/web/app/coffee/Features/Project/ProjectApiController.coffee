ProjectDetailsHandler = require("./ProjectDetailsHandler")
logger = require("logger-sharelatex")


module.exports = 

	getProjectDetails : (req, res, next)->
		{project_id} = req.params
		ProjectDetailsHandler.getDetails project_id, (err, projDetails)->
			return next(err) if err?
			res.json(projDetails)

