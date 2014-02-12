Project = require('../../models/Project').Project
logger = require('logger-sharelatex')

module.exports = 
	markAsUpdated : (project_id, callback)->
		conditions = {_id:project_id}
		update = {lastUpdated:Date.now()}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()
