Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.documentupdater)
keys = Settings.redis.documentupdater.key_schema
request = require("request").defaults(jar: false)
async = require "async"

rclient_sub = require("redis-sharelatex").createClient(Settings.redis.pubsub)
rclient_sub.subscribe "applied-ops"
rclient_sub.setMaxListeners(0)
	
module.exports = DocUpdaterClient =
	randomId: () ->
		chars = for i in [1..24]
			Math.random().toString(16)[2]
		return chars.join("")
	
	subscribeToAppliedOps: (callback = (message) ->) ->
		rclient_sub.on "message", callback

	sendUpdate: (project_id, doc_id, update, callback = (error) ->) ->
		rclient.rpush keys.pendingUpdates({doc_id}), JSON.stringify(update), (error)->
			return callback(error) if error?
			doc_key = "#{project_id}:#{doc_id}"
			rclient.sadd "DocsWithPendingUpdates", doc_key, (error) ->
				return callback(error) if error?
				rclient.rpush "pending-updates-list", doc_key, callback

	sendUpdates: (project_id, doc_id, updates, callback = (error) ->) ->
		DocUpdaterClient.preloadDoc project_id, doc_id, (error) ->
			return callback(error) if error?
			jobs = []
			for update in updates
				do (update) ->
					jobs.push (callback) ->
						DocUpdaterClient.sendUpdate project_id, doc_id, update, callback
			async.series jobs, (err) ->
				DocUpdaterClient.waitForPendingUpdates project_id, doc_id, callback

	waitForPendingUpdates: (project_id, doc_id, callback) ->
		async.retry {times: 30, interval: 100}, (cb) ->
			rclient.llen keys.pendingUpdates({doc_id}), (err, length) ->
				if length > 0
					cb(new Error("updates still pending"))
				else
					cb()
		, callback

	getDoc: (project_id, doc_id, callback = (error, res, body) ->) ->
		request.get "http://localhost:3003/project/#{project_id}/doc/#{doc_id}", (error, res, body) ->
			if body? and res.statusCode >= 200 and res.statusCode < 300
				body = JSON.parse(body)
			callback error, res, body

	getDocAndRecentOps: (project_id, doc_id, fromVersion, callback = (error, res, body) ->) ->
		request.get "http://localhost:3003/project/#{project_id}/doc/#{doc_id}?fromVersion=#{fromVersion}", (error, res, body) ->
			if body? and res.statusCode >= 200 and res.statusCode < 300
				body = JSON.parse(body)
			callback error, res, body

	preloadDoc: (project_id, doc_id, callback = (error) ->) ->
		DocUpdaterClient.getDoc project_id, doc_id, callback

	flushDoc: (project_id, doc_id, callback = (error) ->) ->
		request.post "http://localhost:3003/project/#{project_id}/doc/#{doc_id}/flush", (error, res, body) ->
			callback error, res, body

	setDocLines: (project_id, doc_id, lines, source, user_id, undoing, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3003/project/#{project_id}/doc/#{doc_id}"
			json:
				lines: lines
				source: source
				user_id: user_id
				undoing: undoing
		}, (error, res, body) ->
			callback error, res, body

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		request.del "http://localhost:3003/project/#{project_id}/doc/#{doc_id}", (error, res, body) ->
			callback error, res, body

	flushProject: (project_id, callback = () ->) ->
		request.post "http://localhost:3003/project/#{project_id}/flush", callback

	deleteProject: (project_id, callback = () ->) ->
		request.del "http://localhost:3003/project/#{project_id}", callback

	deleteProjectOnShutdown: (project_id, callback = () ->) ->
		request.del "http://localhost:3003/project/#{project_id}?background=true&shutdown=true", callback

	flushOldProjects: (callback = () ->) ->
		request.get "http://localhost:3003/flush_queued_projects?min_delete_age=1", callback

	acceptChange: (project_id, doc_id, change_id, callback = () ->) ->
		request.post "http://localhost:3003/project/#{project_id}/doc/#{doc_id}/change/#{change_id}/accept", callback

	removeComment: (project_id, doc_id, comment, callback = () ->) ->
		request.del "http://localhost:3003/project/#{project_id}/doc/#{doc_id}/comment/#{comment}", callback

	getProjectDocs: (project_id, projectStateHash, callback = () ->) ->
		request.get "http://localhost:3003/project/#{project_id}/doc?state=#{projectStateHash}", (error, res, body) ->
			if body? and res.statusCode >= 200 and res.statusCode < 300
				body = JSON.parse(body)
			callback error, res, body

	sendProjectUpdate: (project_id, userId, docUpdates, fileUpdates, version, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3003/project/#{project_id}"
			json: { userId, docUpdates, fileUpdates, version }
		}, (error, res, body) ->
			callback error, res, body
