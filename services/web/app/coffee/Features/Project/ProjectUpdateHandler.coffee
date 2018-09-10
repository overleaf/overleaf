Project = require('../../models/Project').Project
logger = require('logger-sharelatex')

module.exports = 
	markAsUpdated : (project_id, user_id, timestamp, callback)->
		conditions = {_id:project_id}
		update = {
			lastUpdated: new Date(timestamp),
			lastUpdatedBy: user_id
		}
		Project.update conditions, update, {}, callback

	markAsOpened : (project_id, callback)->
		conditions = {_id:project_id}
		update = {lastOpened:Date.now()}
		Project.update conditions, update, {}, callback

	markAsInactive: (project_id, callback)->
		conditions = {_id:project_id}
		update = {active:false}
		Project.update conditions, update, {}, callback

	markAsActive: (project_id, callback)->
		conditions = {_id:project_id}
		update = {active:true}
		Project.update conditions, update, {}, callback
