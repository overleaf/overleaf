logger = require "logger-sharelatex"
Settings = require "settings-sharelatex"
redis = require("redis-sharelatex")
LockManager = require("./LockManager")
metrics = require "./Metrics"
async = require("async")

# The aim is to migrate the project history queues
# ProjectHistory:Ops:{project_id} from the existing redis to a new redis.
#
# This has to work in conjunction with changes in project history.
#
# The basic principles are:
#
# - project history is modified to read from an 'old' and 'new' queue. It reads
#   from the 'old' queue first, and when that queue is empty it reads from the
#   'new' queue.
# - docupdater will migrate to writing to the 'new' queue when the 'old' queue
#   is empty.
#
# Some facts about the update process:
#
# - project history has a lock on the project-id, so each queue is processed in
#   isolation
# - docupdaters take a lock on the doc_id but not the project_id, therefore
#   multiple docupdaters can be appending to the queue for a project at the same
#   time (provided they updates for individual docs are in order this is
#   acceptable)
# - as we want to do this without shutting down the site, we have to take into
#   account that different versions of the code will be running while deploys
#   are in progress.
#
# The migration has to be carried out with the following constraint:
#
# - a docupdater should never write to the "old" queue when there are updates in
#   the "new" queue (there is a strict ordering on the versions, new > old)
#
# The deployment process for docupdater will be
#
# - add a project-level lock to the queuing in docupdater
# - use a per-project migration flag to determine when to write to the new redis
# - set the migration flag for projects with an empty queue in the old redis
# - when all docupdaters respect the flag, make a new deploy which starts to set
#   the flag
# - when all docupdaters are setting the flag (and writing to the new redis),
#   finish the migration by writing all data to the new redis
#
# Final stage
#
# When all the queues are migrated, remove the migration code and return to a
# single client pointing at the new redis.  Delete the
# ProjectHistory:MigrationKey:* entries in the new redis.
#
# Rollback
#
# Under the scheme above a project should only ever have data in the old redis
# or the new redis, but never both at the same time.
#
# Two scenarios:
#
# Hard rollback
#
# If we want to roll back to the old redis immediately, we need to get the data
# out of the new queues and back into the old queues, before appending to the
# old queues again.  The actions to do this are:
#
#   - close the site
#   - revert docupdater so it only writes to the original redis (there will now
#     be some data in the new redis for some projects which we need to recover)
#   - run a script to move the new queues back into the old redis
#   - revert project history to only read from the original redis
#
# Graceful rollback
#
# If we are prepared to keep the new redis running, but not add new projects to
# it we can do the following:
#
#  - deploy all docupdaters to update from the "switch" phase into the
#    "rollback" phase (projects in the new redis will continue to send data
#    there, project not yet migrated will continue to go to the old redis)
#  - deploy project history with the "old queue" pointing to the new redis and
#    the "new queue" to the old redis to clear the new queue before processing
#    the new queue (i.e. add a rollback:true property in new_project_history in
#    the project-history settings via the environment variable
#    MIGRATION_PHASE="rollback").
#  - projects will now clear gradually from the new redis back to the old redis
#  - get a list of all the projects in the new redis and flush them, which will
#    cause the new queues to be cleared and the old redis to be used for those
#    projects.

getProjectId = (key) ->
	key.match(/\{([0-9a-f]{24})\}/)[1]

class Multi
	constructor: (@migrationClient) ->
		@command_list = []
		@queueKey = null
	rpush: (args...) ->
		@queueKey = args[0]
		@updates_count = args.length - 1
		@command_list.push { command:'rpush', args: args}
	setnx: (args...) ->
		@command_list.push { command: 'setnx', args: args}
	exec: (callback) ->
		# decide which client to use
		project_id = getProjectId(@queueKey)
		# Put a lock around finding and updating the queue to avoid time-of-check to
		# time-of-use problems. When running in the "switch" phase we need a lock to
		# guarantee the order of operations. (Example: docupdater A sees an old
		# queue at t=t0 and pushes onto it at t=t1, project history clears the queue
		# between t0 and t1, and docupdater B sees the empty queue, sets the
		# migration flag and pushes onto the new queue at t2. Without a lock it's
		# possible to have t2 < t1 if docupdater A is slower than B - then there
		# would be entries in the old and new queues, which we want to avoid.)
		LockManager.getLock project_id, (error, lockValue) =>
			return callback(error) if error?
			releaseLock = (args...) =>
				LockManager.releaseLock project_id, lockValue, (lockError) ->
					return callback(lockError) if lockError?
					callback(args...)
			@migrationClient.findQueue @queueKey, (err, rclient) =>
				return releaseLock(err) if err?
				# add metric for updates
				dest = (if rclient == @migrationClient.rclient_new then "new" else "old")
				metrics.count "migration", @updates_count, 1, {status: "#{@migrationClient.migration_phase}-#{dest}"}
				multi = rclient.multi()
				for entry in @command_list
					multi[entry.command](entry.args...)
				multi.exec releaseLock

class MigrationClient
	constructor: (@old_settings, @new_settings) ->
		@rclient_old = redis.createClient(@old_settings)
		@rclient_new = redis.createClient(@new_settings)
		@new_key_schema = new_settings.key_schema
		# check that migration phase is valid on startup
		logger.warn {migration_phase: @getMigrationPhase()}, "running with RedisMigrationManager"

	getMigrationPhase: () ->
		@migration_phase = @new_settings.migration_phase  # FIXME: allow setting migration phase while running for testing
		throw new Error("invalid migration phase") unless @migration_phase in ['prepare', 'switch', 'rollback']
		return @migration_phase

	getMigrationStatus: (key, migrationKey, callback) ->
		async.series [
			(cb) => @rclient_new.exists migrationKey, cb
			(cb) => @rclient_new.exists key, cb
			(cb) => @rclient_old.exists key, cb
		], (err, result) ->
			return callback(err) if err?
			migrationKeyExists = result[0] > 0
			newQueueExists = result[1] > 0
			oldQueueExists = result[2] > 0
			callback(null, migrationKeyExists, newQueueExists, oldQueueExists)

	findQueue: (key, callback) ->
		project_id = getProjectId(key)
		migrationKey = @new_key_schema.projectHistoryMigrationKey({project_id})
		migration_phase = @getMigrationPhase()  # allow setting migration phase while running for testing
		@getMigrationStatus key, migrationKey, (err, migrationKeyExists, newQueueExists, oldQueueExists) =>
			return callback(err) if err?
			# In all cases, if the migration key exists we must always write to the
			# new redis, unless we are rolling back.
			if migration_phase is "prepare"
			# in this phase we prepare for the switch, when some docupdaters will
			# start setting the migration flag.  We monitor the migration key and
			# write to the new redis if the key is present, but we do not set the
			# migration key. At this point no writes will be going into the new
			# redis. When all the docupdaters are in the "prepare" phase we can
			# begin deploying the "switch" phase.
				if migrationKeyExists
					logger.debug {project_id}, "using new client because migration key exists"
					return callback(null, @rclient_new)
				else
					logger.debug {project_id}, "using old client because migration key does not exist"
					return callback(null, @rclient_old)
			else if migration_phase is "switch"
				# As we deploy the "switch" phase new docupdaters will set the migration
				# flag for projects which have an empty queue in the old redis, and
				# write updates into the new redis.  Existing docupdaters still in the
				# "prepare" phase will pick up the migration flag and write new updates
				# into the new redis when appropriate.  When this deploy is complete
				# writes will be going into the new redis for projects with an empty
				# queue in the old redis.  We have to remain in the switch phase until
				# all projects are flushed from the old redis.
				if migrationKeyExists
					logger.debug {project_id}, "using new client because migration key exists"
					return callback(null, @rclient_new)
				else
					if oldQueueExists
						logger.debug {project_id}, "using old client because old queue exists"
						return callback(null, @rclient_old)
					else
						@rclient_new.setnx migrationKey, "NEW", (err) =>
							return callback(err) if err?
							logger.debug {key: key}, "switching to new redis because old queue is empty"
							return callback(null, @rclient_new)
			else if migration_phase is "rollback"
				# If we need to roll back gracefully we do the opposite of the "switch"
				# phase. We use the new redis when the migration key is set and the
				# queue exists in the new redis, but if the queue in the new redis is
				# empty we delete the migration key and send further updates to the old
				# redis.
				if migrationKeyExists
					if newQueueExists
						logger.debug {project_id}, "using new client because migration key exists and new queue is present"
						return callback(null, @rclient_new)
					else
						@rclient_new.del migrationKey, (err) =>
							return callback(err) if err?
							logger.debug {key: key}, "switching to old redis in rollback phase because new queue is empty"
							return callback(null, @rclient_old)
				else
					logger.debug {project_id}, "using old client because migration key does not exist"
					return callback(null, @rclient_old)
			else
				logger.error {key: key, migration_phase: migration_phase}, "unknown migration phase"
				callback(new Error('invalid migration phase'))
	multi: () ->
		new Multi(@)

module.exports = RedisMigrationManager =
	createClient: (args...) ->
		new MigrationClient(args...)
