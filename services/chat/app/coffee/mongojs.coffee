Settings = require("settings-sharelatex")
mongojs = require "mongojs"
db = mongojs(Settings.mongo.url, ["rooms", "messages"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId
