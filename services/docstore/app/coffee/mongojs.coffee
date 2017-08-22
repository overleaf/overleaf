Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs(Settings.mongo.url, ["docs", "docOps"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId

