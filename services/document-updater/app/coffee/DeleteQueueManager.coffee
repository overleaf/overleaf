Settings = require('settings-sharelatex')
RedisManager = require "./RedisManager"
ProjectManager = require "./ProjectManager"
logger = require "logger-sharelatex"
metrics = require "./Metrics"
async = require "async"

# Maintain a sorted set of project flushAndDelete requests, ordered by timestamp
# (ZADD), and process them from oldest to newest. A flushAndDelete request comes
# from real-time and is triggered when a user leaves a project. 
#
# The aim is to remove the project from redis 5 minutes after the last request
# if there has been no activity (document updates) in that time.  If there is
# activity we can expect a further flushAndDelete request when the editing user
# leaves the project. 
#
# If a new flushAndDelete request comes in while an existing request is already
# in the queue we update the timestamp as we can postpone flushing further.
#
# Documents are processed by checking the queue, seeing if the first entry is
# older than 5 minutes, and popping it from the queue in that case.

module.exports = DeleteQueueManager =
    flushAndDeleteOldProjects: (options, callback) ->
        startTime = Date.now()
        cutoffTime = startTime - options.min_delete_age + 100 * (Math.random() - 0.5)
        count = 0

        flushProjectIfNotModified = (project_id, flushTimestamp, cb) ->
            ProjectManager.getProjectDocsTimestamps project_id, (err, timestamps) ->
                return callback(err) if err?
                if timestamps.length == 0
                    logger.log {project_id}, "skipping flush of queued project - no timestamps"
                    return cb()
                # are any of the timestamps newer than the time the project was flushed?
                for timestamp in timestamps when timestamp > flushTimestamp
                    metrics.inc "queued-delete-skipped"
                    logger.debug {project_id, timestamps, flushTimestamp}, "found newer timestamp, will skip delete"
                    return cb()
                logger.log {project_id, flushTimestamp}, "flushing queued project"
                ProjectManager.flushAndDeleteProjectWithLocks project_id, {skip_history_flush: false}, (err) ->
                    if err?
                        logger.err {project_id, err}, "error flushing queued project"
                    metrics.inc "queued-delete-completed"
                    return cb(null, true)

        flushNextProject = () ->
            now = Date.now()
            if now - startTime > options.timeout
                logger.log "hit time limit on flushing old projects"
                return callback(null, count)
            if count > options.limit
                logger.log "hit count limit on flushing old projects"
                return callback(null, count)
            RedisManager.getNextProjectToFlushAndDelete cutoffTime, (err, project_id, flushTimestamp, queueLength) ->
                return callback(err) if err?
                return callback(null, count) if !project_id?
                logger.log {project_id, queueLength: queueLength}, "flushing queued project"
                metrics.globalGauge "queued-flush-backlog", queueLength
                flushProjectIfNotModified project_id, flushTimestamp, (err, flushed) ->
                    count++ if flushed
                    flushNextProject()

        flushNextProject()

    startBackgroundFlush: () ->
        SHORT_DELAY = 10
        LONG_DELAY = 1000
        doFlush = () ->
            if Settings.shuttingDown
                logger.warn "discontinuing background flush due to shutdown"
                return
            DeleteQueueManager.flushAndDeleteOldProjects {
                timeout:1000,
                min_delete_age:3*60*1000,
                limit:1000 # high value, to ensure we always flush enough projects
            }, (err, flushed) ->
                setTimeout doFlush, (if flushed > 10 then SHORT_DELAY else LONG_DELAY)
        doFlush()
