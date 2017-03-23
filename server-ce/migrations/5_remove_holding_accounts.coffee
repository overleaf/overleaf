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
					if !project?._id?
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
		if !HoldingAccountMigration.DRY_RUN
			db.users.remove {_id: user_id, holdingAccount: true}, (error, result) ->
				return callback(error) if error?
				console.log "[Removed user]", user_id, result
				if result.n != 1
					return callback(new Error("failed to remove user as expected"))
				callback()
		else
			console.log "[Would have removed user]", user_id
			callback()

	run: (done = () ->) ->
		console.log "[Getting list of holding accounts]"
		HoldingAccountMigration.findHoldingAccounts (error, users) ->
			throw error if error?
			console.log "[Got #{users.length} holding accounts]"
			jobs = users.map (u) ->
				(cb) ->
					HoldingAccountMigration.deleteUser u._id, (error) ->
						return cb(error) if error?
						HoldingAccountMigration.deleteUserProjects u._id, (error) ->
							return cb(error) if error?
							setTimeout cb, 50 # Small delay to not hammer DB
			async.series jobs, (error) ->
				throw error if error?
				console.log "[FINISHED]"
				done()

	migrate: (client, done=()->) ->
		HoldingAccountMigration.DRY_RUN = false
		HoldingAccountMigration.run(done)
				
	rollback: (client, done) ->
		done()
