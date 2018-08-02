Settings = require "settings-sharelatex"
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['docs','docHistory', 'docHistoryStats'])
_ = require("underscore")
async = require("async")
exec = require("child_process").exec
bson = require('bson')
BSON = new bson()


handleExit = () ->
	console.log('Got signal.  Shutting down.')


exports.migrate = (client, done=()->) ->
	console.log ">> Adding indexes for token-based project access: "
	db.projects.ensureIndex {'tokens.readAndWrite': 1}, {
		partialFilterExpression: { 'tokens.readAndWrite': { $exists: true } },
		unique: true,
		background: true
	}, (err) ->
		if err?
			return done(err)
		db.projects.ensureIndex {'tokens.readOnly': 1}, {
			partialFilterExpression: { 'tokens.readOnly': { $exists: true } },
			unique: true,
			background: true
		}, (err) ->
			if err?
				return done(err)
			db.projects.ensureIndex {tokenAccessReadAndWrite_refs: 1}, {
				background: true
			}, (err) ->
				if err?
					return done(err)
				db.projects.ensureIndex {tokenAccessOnly_refs: 1}, {
					background: true
				}, (err) ->
					console.log ">> done adding indexes for token-based project access"
					done()


exports.rollback = (client, done) ->
	done()


process.on 'SIGINT', handleExit
process.on 'SIGHUP', handleExit

