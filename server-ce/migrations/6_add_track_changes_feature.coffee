Settings = require "settings-sharelatex"
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['users'])
_ = require("underscore")


handleExit = () ->
	console.log('Got signal.  Shutting down.')


process.on 'SIGINT', handleExit
process.on 'SIGHUP', handleExit


exports.migrate = (client, done=()->) ->
	patch = {
		$set: {
			'features.trackChanges': true
		}
	}
	console.log ">> enabling trackChanges feature: ", patch
	db.users.update {}, patch, {multi: true}, (err) ->
		console.log "finished enabling trackChanges feature"
		return done(err)


exports.rollback = (client, done) ->
	done()
