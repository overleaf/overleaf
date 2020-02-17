const Settings = require("settings-sharelatex");
const mongojs = require("mongojs");
const bson = require("bson");
const db = mongojs(Settings.mongo.url, ["docHistory", "projectHistoryMetaData", "docHistoryIndex"]);
module.exports = {
	db,
	ObjectId: mongojs.ObjectId,
	BSON: new bson.BSONPure()
};

