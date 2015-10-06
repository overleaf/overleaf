Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs.connect(Settings.mongo.url, ["contacts"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId

