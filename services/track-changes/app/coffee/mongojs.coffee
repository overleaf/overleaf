Settings = require "settings-sharelatex"
mongojs = require "mongojs"
bson = require "bson"
db = mongojs(Settings.mongo.url, ["docHistory", "projectHistoryMetaData", "docHistoryStats"])
module.exports =
	db: db
	ObjectId: mongojs.ObjectId
	BSON: bson

