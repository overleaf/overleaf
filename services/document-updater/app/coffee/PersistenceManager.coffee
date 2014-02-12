request = require "request"
Settings = require "settings-sharelatex"
Errors = require "./Errors"
Metrics = require "./Metrics"

module.exports = PersistenceManager =
	getDoc: (project_id, doc_id, _callback = (error, lines) ->) ->
		timer = new Metrics.Timer("persistenceManager.getDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		url = "#{Settings.apis.web.url}/project/#{project_id}/doc/#{doc_id}"
		request {
			url: url
			method: "GET"
			headers:
				"accept": "application/json"
			auth:
				user: Settings.apis.web.user
				pass: Settings.apis.web.pass
				sendImmediately: true
			jar: false
		}, (error, res, body) ->
			return callback(error) if error?
			if res.statusCode >= 200 and res.statusCode < 300
				try
					body = JSON.parse body
				catch e
					return callback(e)
				return callback null, body.lines
			else if res.statusCode == 404
				return callback(new Errors.NotFoundError("doc not not found: #{url}"))
			else
				return callback(new Error("error accessing web API: #{url} #{res.statusCode}"))

	setDoc: (project_id, doc_id, lines, _callback = (error) ->) ->
		timer = new Metrics.Timer("persistenceManager.setDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		url = "#{Settings.apis.web.url}/project/#{project_id}/doc/#{doc_id}"
		request {
			url: url
			method: "POST"
			body: JSON.stringify
				lines: lines
			headers:
				"content-type": "application/json"
			auth:
				user: Settings.apis.web.user
				pass: Settings.apis.web.pass
				sendImmediately: true
			jar: false
		}, (error, res, body) ->
			return callback(error) if error?
			if res.statusCode >= 200 and res.statusCode < 300
				return callback null
			else if res.statusCode == 404
				return callback(new Errors.NotFoundError("doc not not found: #{url}"))
			else
				return callback(new Error("error accessing web API: #{url} #{res.statusCode}"))
		

			
