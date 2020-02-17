const Settings = require("settings-sharelatex");
const mongojs = require("mongojs");
const db = mongojs(Settings.mongo.url, ["contacts"]);
module.exports = {
	db,
	ObjectId: mongojs.ObjectId
};

