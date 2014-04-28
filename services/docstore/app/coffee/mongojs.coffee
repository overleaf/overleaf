Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs.connect(Settings.mongo.url, ["projects"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId

