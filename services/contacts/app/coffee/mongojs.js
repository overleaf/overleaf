Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs(Settings.mongo.url, ["contacts"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId

