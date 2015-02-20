Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs.connect(Settings.mongo.url, ["docs"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId

