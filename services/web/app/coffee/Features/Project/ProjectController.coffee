logger = require("logger-sharelatex")
projectDeleter = require("./ProjectDeleter")
projectDuplicator = require("./ProjectDuplicator")
projectCreationHandler = require("./ProjectCreationHandler")
metrics = require('../../infrastructure/Metrics')
sanitize = require('sanitizer')



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


	newProject: (req, res)->
		user = req.session.user
		projectName = sanitize.escape(req.body.projectName)
		template = sanitize.escape(req.body.template)
		logger.log user: user, type: template, name: projectName, "creating project"
		if template == 'example'
			projectCreationHandler.createExampleProject user._id, projectName, (err, project)->
				if err?
					logger.error err: err, project: project, user: user, name: projectName, type: "example", "error creating project"
					res.send 500
				else
					logger.log project: project, user: user, name: projectName, type: "example", "created project"
					res.send {project_id:project._id}
		else
			projectCreationHandler.createBasicProject user._id, projectName, (err, project)->
				if err?
					logger.error err: err, project: project, user: user, name: projectName, type: "basic", "error creating project"
					res.send 500
				else
					logger.log project: project, user: user, name: projectName, type: "basic", "created project"
					res.send {project_id:project._id}