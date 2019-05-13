Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs(Settings.mongo.url, ["projects", "users", "userstubs", "tokens", "docSnapshots", "projectHistoryFailures"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId
