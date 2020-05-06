Settings = require "settings-sharelatex"
mongojs = require "mongojs"
db = mongojs(Settings.mongo.url, ["docSnapshots"])

module.exports =
	db: db
	ObjectId: mongojs.ObjectId
	healthCheck: (callback) ->
		db.runCommand {ping: 1}, (err, res) ->
			return callback(err) if err?
			return callback(new Error("failed mongo ping")) if !res.ok
			callback()
