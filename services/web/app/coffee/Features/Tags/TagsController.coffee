TagsHandler = require("./TagsHandler")
logger = require("logger-sharelatex")

module.exports =

	processTagsUpdate: (req, res)->
		user_id = req.session.user._id
		project_id = req.params.project_id
		if req.body.deletedTag?
			tag = req.body.deletedTag
			TagsHandler.deleteTag user_id, project_id, tag, ->
				res.send()
		else
			tag = req.body.tag
			TagsHandler.addTag user_id, project_id, tag, ->
				res.send()
		logger.log user_id:user_id, project_id:project_id, body:req.body, "processing tag update"

	getAllTags: (req, res)->
		TagsHandler.getAllTags req.session.user._id, (err, allTags)->
			res.send(allTags)
