const Settings = require("settings-sharelatex");
const mongojs = require("mongojs");
const db = mongojs(Settings.mongo.url, ["docs", "docOps"]);
module.exports = {
	db,
	ObjectId: mongojs.ObjectId
};

