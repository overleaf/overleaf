TagsHandler = require("./TagsHandler")
logger = require("logger-sharelatex")

module.exports =
	getAllTags: (req, res, next)->
		user_id = req.session.user._id
		logger.log {user_id}, "getting tags"
		TagsHandler.getAllTags user_id, (error, allTags)->
			return next(error) if error?
			res.json(allTags)
	
	createTag: (req, res, next) ->
		user_id = req.session.user._id
		name = req.body.name
		logger.log {user_id, name}, "creating tag"
		TagsHandler.createTag user_id, name, (error, tag) ->
			return next(error) if error?
			res.json(tag)
	
	addProjectToTag: (req, res, next) ->
		user_id = req.session.user._id
		{tag_id, project_id} = req.params
		logger.log {user_id, tag_id, project_id}, "adding tag to project"
		TagsHandler.addProjectToTag user_id, tag_id, project_id, (error) ->
			return next(error) if error?
			res.status(204).end()
	
	removeProjectFromTag: (req, res, next) ->
		user_id = req.session.user._id
		{tag_id, project_id} = req.params
		logger.log {user_id, tag_id, project_id}, "removing tag from project"
		TagsHandler.removeProjectFromTag user_id, tag_id, project_id, (error) ->
			return next(error) if error?
			res.status(204).end()
	
	deleteTag: (req, res, next) ->
		user_id = req.session.user._id
		tag_id = req.params.tag_id
		logger.log {user_id, tag_id}, "deleting tag"
		TagsHandler.deleteTag user_id, tag_id, (error) ->
			return next(error) if error?
			res.status(204).end()
	
	renameTag: (req, res, next) ->
		user_id = req.session.user._id
		tag_id = req.params.tag_id
		name = req.body?.name
		if !name?
			return res.status(400).end()
		else
			logger.log {user_id, tag_id, name}, "renaming tag"
			TagsHandler.renameTag user_id, tag_id, name, (error) ->
				return next(error) if error?
				res.status(204).end()
