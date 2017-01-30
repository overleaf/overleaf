Settings = require "settings-sharelatex"
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['users', 'projects'])
async = require "async"

module.exports = HoldingAccountMigration = 
	DRY_RUN: true

	findHoldingAccounts: (callback = (error, users) ->) ->
		db.users.find({holdingAccount: true}, {holdingAccount: 1, email: 1}, callback)

	deleteUserProjects: (user_id, callback = (error) ->) ->
		# Holding accounts can't own projects, so only remove from 
		# collaberator_refs and readOnly_refs
		console.log "[Removing user from projects]", user_id
		db.projects.find {
			$or: [
				{collaberator_refs: user_id},
				{readOnly_refs: user_id}
			]
		}, { collaberator_refs: 1, readOnly_refs: 1 }, (error, projects = []) ->
			return callback(error) if error?
			jobs = projects.map (project) ->
				(cb) ->
					console.log "[Removing user from project]", user_id, JSON.stringify(project)
					if !project._id?
						throw new Error("no project id")
				
					if !HoldingAccountMigration.DRY_RUN
						db.projects.update {
							_id: project._id
						}, {
							$pull: {
								collaberator_refs: user_id,
								readOnly_refs: user_id
							}
						}, (error, result) ->
							return cb(error) if error?
							console.log "[Removed user from project]", user_id, project._id, result
							cb()
					else
						console.log "[Would have removed user from project]", user_id, project._id
						cb()
						
			async.series jobs, callback

	deleteUser: (user_id, callback = (error) ->) ->
		if !user_id?
			throw new Error("must have user_id")
		db.users.find {_id: user_id}, (error, user) ->
			return callback(error) if error?
			if !user?
				throw new Error("expected user")
			console.log "[Removing user]", user_id, JSON.stringify(user)
			if !HoldingAccountMigration.DRY_RUN
				db.users.remove {_id: user_id}, (error, result) ->
					console.log "[Removed user]", user_id, result
					callback(error)
			else
				console.log "[Would have removed user]", user_id
				callback()

	run: (done) ->
		HoldingAccountMigration.findHoldingAccounts (error, users) ->
			throw error if error?
			console.log "[Got list of holding accounts]", users.map (u) -> u._id
			jobs = users.map (u) ->
				(cb) ->
					HoldingAccountMigration.deleteUserProjects u._id, (error) ->
						return cb(error) if error?
						HoldingAccountMigration.deleteUser u._id, cb
			async.series jobs, (error) ->
				throw error if error?
				console.log "[Removed holding accounts]"
				done()

	migrate: (client, done=()->) ->
		HoldingAccountMigration.DRY_RUN = false
		HoldingAccountMigration.run(done)
				
	rollback: (client, done) ->
		done()
