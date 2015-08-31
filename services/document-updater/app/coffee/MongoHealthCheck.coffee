Settings = require "settings-sharelatex"
PersistenceManager = require "./PersistenceManager"

module.exports = MongoHealthCheck =
	isAlive: (_callback = (error) ->) ->
		# We've seen very occasionally the doc-updater losing its connection to Mongo.
		# E.g. https://sharelatex.hackpad.com/29th-Aug-2015-0650-0740-fHlw8RL8zuN
		# It seems that the mongo callbacks never returned.
		# Mongo is only called in the persistence manager, so we do a read-only
		# test call, check that it's working, and returns in a reasonable time.
		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		doc_id = Settings.smokeTest?.doc_id
		if !doc_id?
			return callback(new Error("No test doc_id configured"))

		PersistenceManager.getDocVersionInMongo doc_id, (error, version) ->
			return callback(error) if error?
			callback(null)

		timeout = Settings.smokeTest?.timeout or 10000
		setTimeout () ->
			callback(new Error("Mongo did not return in #{timeout}ms"))
		, timeout