logger = require("logger-sharelatex")
projectDeleter = require("./ProjectDeleter")
projectDuplicator = require("./ProjectDuplicator")
metrics = require('../../infrastructure/Metrics')



module.exports =

	deleteProject: (req, res)->
		project_id = req.params.Project_id
		logger.log project_id:project_id, "deleting project"
		projectDeleter.deleteProject project_id, (err)->
			if err?
				res.send 500
			else
				res.send 200

	cloneProject: (req, res)->
		metrics.inc "cloned-project"
		project_id = req.params.Project_id
		projectName = req.body.projectName
		logger.log project_id:project_id, projectName:projectName, "cloning project"
		if !req.session.user?
			return res.send redir:"/register"
		projectDuplicator.duplicate req.session.user, project_id, projectName, (err, project)->
			if err?
				logger.error err:err, project_id: project_id, user_id: req.session.user._id, "error cloning project"
				return next(err)
			res.send(project_id:project._id)