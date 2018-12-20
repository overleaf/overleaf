const Settings = require("settings-sharelatex");
const mongojs = require("mongojs");
const db = mongojs(Settings.mongo.url, ["rooms", "messages"]);
module.exports = {
	db,
	ObjectId: mongojs.ObjectId
};
