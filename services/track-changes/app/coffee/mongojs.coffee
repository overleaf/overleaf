Settings = require "settings-sharelatex"
mongojs = require "mongojs"
bson = require "bson"
db = mongojs(Settings.mongo.url, ["docHistory", "projectHistoryMetaData", "docHistoryIndex"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId
	BSON: new bson.BSONPure()

