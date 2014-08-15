Settings = require("settings-sharelatex")
mongojs = require "mongojs"
db = mongojs.connect(Settings.mongo.url, ["rooms", "messages"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId
