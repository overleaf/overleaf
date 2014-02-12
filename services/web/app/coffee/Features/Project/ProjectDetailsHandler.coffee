ProjectGetter = require("./ProjectGetter")
Project = require('../../models/Project').Project
logger = require("logger-sharelatex")

module.exports = 

	getDetails: (project_id, callback)->
		ProjectGetter.getProjectWithoutDocLines project_id, (err, project)->
			if err?
				logger.err err:err, project_id:project_id, "error getting project"
				return callback(err)
			details =
				name : project.name
				description: project.description
				compiler: project.compiler
			logger.log project_id:project_id, details:details, "getting project details"
			callback(err, details)

	setProjectDescription: (project_id, description, callback)->
		conditions = _id:project_id
		update = description:description
		logger.log conditions:conditions, update:update, project_id:project_id, description:description, "setting project description"
		Project.update conditions, update, (err)->
			if err?
				logger.err err:err, "something went wrong setting project description"
			callback(err)
