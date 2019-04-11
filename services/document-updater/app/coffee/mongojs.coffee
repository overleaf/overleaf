Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs(Settings.mongo.url, ["docSnapshots"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId

