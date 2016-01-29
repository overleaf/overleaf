TagsHandler = require("./TagsHandler")
logger = require("logger-sharelatex")

module.exports =

	processTagsUpdate: (req, res)->
		user_id = req.session.user._id
		project_id = req.params.project_id
		tag = req.body.tag
		TagsHandler.addTag user_id, project_id, tag, ->
			res.send()
		logger.log user_id:user_id, project_id:project_id, body:req.body, "processing tag update"

	getAllTags: (req, res)->
		TagsHandler.getAllTags req.session.user._id, (err, allTags)->
			res.send(allTags)
	
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
