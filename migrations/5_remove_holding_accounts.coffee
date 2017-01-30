Settings = require "settings-sharelatex"
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['users', 'projects'])
async = require "async"

findHoldingAccounts = (callback = (error, users) ->) ->
	db.users.find({holdingAccount: true}, {holdingAccount: 1, email: 1}, callback)

deleteUserProjects = (user_id, callback = (error) ->) ->
	# Holding accounts can't own projects, so only remove from 
	# collaberator_refs and readOnly_refs
	console.log "[Removing user from projects]", user_id
	db.projects.update {
		$or: [
			{collaberator_refs: user_id},
			{readOnly_refs: user_id}
		]
	}, {
		$pull: {
			collaberator_refs: user_id,
			readOnly_refs: user_id
		}
	}, {
		multi: true
	}, (error, result) ->
		console.log "[Removed user from projects]", user_id, result
		callback(error)

deleteUser = (user_id, callback = (error) ->) ->
	if !user_id?
		throw new Error("must have user_id")
	console.log "[Removing user]", user_id
	db.users.remove {_id: user_id}, (error, result) ->
		console.log "[Removed user]", user_id, result
		callback(error)

exports.migrate = (client, done=()->) ->
	findHoldingAccounts (error, users) ->
		throw error if error?
		console.log "[Got list of holding accounts]", users.map (u) -> u._id
		jobs = users.map (u) ->
			(cb) ->
				deleteUserProjects u._id, (error) ->
					return cb(error) if error?
					deleteUser u._id, cb
		async.series jobs, (error) ->
			throw error if error?
			console.log "[Removed holding accounts]"
			done()
			
exports.rollback = (client, done) ->
	done()
