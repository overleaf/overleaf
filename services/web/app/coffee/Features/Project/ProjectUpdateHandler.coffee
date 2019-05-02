Project = require('../../models/Project').Project
logger = require('logger-sharelatex')

module.exports = 
	markAsUpdated : (projectId, lastUpdatedAt, lastUpdatedBy, callback = () ->)->
		lastUpdatedAt ?= new Date()

		conditions =
			_id: projectId
			lastUpdated: { $lt: lastUpdatedAt }

		update = {
			lastUpdated: lastUpdatedAt or (new Date()).getTime()
			lastUpdatedBy: lastUpdatedBy
		}
		Project.update conditions, update, {}, callback

	markAsOpened : (project_id, callback)->
		conditions = {_id:project_id}
		update = {lastOpened:Date.now()}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()

	markAsInactive: (project_id, callback)->
		conditions = {_id:project_id}
		update = {active:false}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()

	markAsActive: (project_id, callback)->
		conditions = {_id:project_id}
		update = {active:true}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()
