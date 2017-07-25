Settings = require "settings-sharelatex"
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['users', 'projects', 'subscriptions'])
async = require "async"

module.exports = HoldingAccountMigration = 
	DRY_RUN: true

	findHoldingAccounts: (callback = (error, users) ->) ->
		db.users.find({holdingAccount: true, hashedPassword: { $exists: false }}, {holdingAccount: 1, email: 1}, callback)

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
	
	migrateGroupInvites: (user_id, email, callback = (error) ->) ->
		if !user_id?
			throw new Error("must have user_id")
		if !HoldingAccountMigration.DRY_RUN
			db.subscriptions.update {member_ids: user_id}, {
				$pull: { member_ids: user_id },
				$addToSet : { invited_emails: email }
			}, { multi : true }, (error, result) ->
				return callback(error) if error?
				console.log "[Migrated user in group accounts]", user_id, email, result
				callback()
		else
			console.log "[Would have migrated user in group accounts]", user_id, email
			callback()

	run: (done = () ->) ->
		console.log "[Getting list of holding accounts]"
		HoldingAccountMigration.findHoldingAccounts (error, users) ->
			throw error if error?
			console.log "[Got #{users.length} holding accounts]"
			i = 0
			jobs = users.map (u) ->
				(cb) ->
					console.log "[Removing user #{i++}/#{users.length}]"
					HoldingAccountMigration.migrateGroupInvites u._id, u.email, (error) ->
						return cb(error) if error?
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
