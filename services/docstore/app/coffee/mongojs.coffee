Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs.connect(Settings.mongo.url, ["projects", "docs"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId

