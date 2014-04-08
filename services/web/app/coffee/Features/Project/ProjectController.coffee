logger = require("logger-sharelatex")
projectDeleter = require("./ProjectDeleter")




module.exports =

	deleteProject: (req, res)->
		project_id = req.params.Project_id
		logger.log project_id:project_id, "deleting project"
		projectDeleter.deleteProject project_id, (err)->
			if err?
				res.send 500
			else
				res.send 200