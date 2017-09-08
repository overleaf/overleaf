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
			features: {
				collaborators: -1
				dropbox: true
				versioning: true
				references: true
				templates: true
				compileTimeout: 180
				compileGroup: "standard"
			}
		}
	}
	console.log ">> updating all user features: ", patch
	db.users.update {}, patch, {multi: true}, (err) ->
		console.log "finished updating all user features"
		return done(err)


exports.rollback = (client, done) ->
	done()
