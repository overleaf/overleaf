Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs.connect(Settings.mongo.restoreUrl, ["projects", "users"])
ObjectId = mongojs.ObjectId
VersioningApiHandler = require "../Versioning/VersioningApiHandler"

module.exports = RestoreController =
	restore: (req, res, next = (error) ->) ->
		user_id = req.session.user._id
		db.projects.find { owner_ref: ObjectId(user_id) }, { _id: 1, name: 1 }, (error, projects) ->
			return next(error) if error?
			res.render 'restore', projects: projects, title: "Restore projects"

	getZip: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		VersioningApiHandler.proxyToVersioningApi(req, res)