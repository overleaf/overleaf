Project = require('../../models/Project').Project
logger = require('logger-sharelatex')
Project = require("../../models/Project").Project

module.exports = 
	markAsUpdated : (project_id, callback)->
		conditions = {_id:project_id}
		update = {lastUpdated:Date.now()}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()

	markAsOpened : (project_id, callback)->
		conditions = {_id:project_id}
		update = {lastOpened:Date.now()}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()

	markAsInactive: (project_id, callback)->
		conditions = {_id:project_id}
		update = {inactive:true}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()

	markAsActive: (project_id, callback)->
		conditions = {_id:project_id}
		update = { $unset: { inactive: true }}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()