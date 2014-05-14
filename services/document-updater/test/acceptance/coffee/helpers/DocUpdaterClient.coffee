rclient = require("redis").createClient()
request = require("request").defaults(jar: false)
async = require "async"

module.exports = DocUpdaterClient =
	randomId: () ->
		chars = for i in [1..24]
			Math.random().toString(16)[2]
		return chars.join("")

	sendUpdate: (project_id, doc_id, update, callback = (error) ->) ->
		rclient.rpush "PendingUpdates:#{doc_id}", JSON.stringify(update), (error)->
			return callback(error) if error?
			doc_key = "#{project_id}:#{doc_id}"
			rclient.sadd "DocsWithPendingUpdates", doc_key, (error) ->
				return callback(error) if error?
				rclient.publish "pending-updates", doc_key, callback

	sendUpdates: (project_id, doc_id, updates, callback = (error) ->) ->
		DocUpdaterClient.preloadDoc project_id, doc_id, (error) ->
			return callback(error) if error?
			jobs = []
			for update in updates
				do (update) ->
					jobs.push (callback) ->
						DocUpdaterClient.sendUpdate project_id, doc_id, update, callback
			async.series jobs, callback

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

	setDocLines: (project_id, doc_id, lines, source, user_id, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3003/project/#{project_id}/doc/#{doc_id}"
			json:
				lines: lines
				source: source
				user_id: user_id
		}, (error, res, body) ->
			callback error, res, body

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		request.del "http://localhost:3003/project/#{project_id}/doc/#{doc_id}", (error, res, body) ->
			callback error, res, body

	flushProject: (project_id, callback = () ->) ->
		request.post "http://localhost:3003/project/#{project_id}/flush", callback

	deleteProject: (project_id, callback = () ->) ->
		request.del "http://localhost:3003/project/#{project_id}", callback
		
		
		
	
