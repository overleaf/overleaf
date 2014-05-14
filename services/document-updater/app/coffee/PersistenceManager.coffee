request = require "request"
Settings = require "settings-sharelatex"
Errors = require "./Errors"
Metrics = require "./Metrics"
{db, ObjectId} = require("./mongojs")
logger = require "logger-sharelatex"

module.exports = PersistenceManager =
	getDoc: (project_id, doc_id, callback = (error, lines, version) ->) ->
		PersistenceManager.getDocFromWeb project_id, doc_id, (error, lines, webVersion) ->
			return callback(error) if error?
			PersistenceManager.getDocVersionInMongo doc_id, (error, mongoVersion) ->
				return callback(error) if error?
				if !webVersion? and !mongoVersion?
					version = 0
				else if !webVersion?
					logger.warn project_id: project_id, doc_id: doc_id, "loading doc version from mongo - deprecated"
					version = mongoVersion
				else if !mongoVersion?
					version = webVersion
				else if webVersion > mongoVersion
					version = webVersion
				else
					version = mongoVersion
				callback null, lines, version

	setDoc: (project_id, doc_id, lines, version, callback = (error) ->) ->
		PersistenceManager.setDocInWeb project_id, doc_id, lines, version, (error) ->
			return callback(error) if error?
			PersistenceManager.setDocVersionInMongo doc_id, version, (error) ->
				return callback(error) if error?
				callback()

	getDocFromWeb: (project_id, doc_id, _callback = (error, lines, version) ->) ->
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
				return callback null, body.lines, body.version
			else if res.statusCode == 404
				return callback(new Errors.NotFoundError("doc not not found: #{url}"))
			else
				return callback(new Error("error accessing web API: #{url} #{res.statusCode}"))

	setDocInWeb: (project_id, doc_id, lines, version, _callback = (error) ->) ->
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
				version: parseInt(version, 10)
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
		
	getDocVersionInMongo: (doc_id, callback = (error, version) ->) ->
		db.docOps.find {
			doc_id: ObjectId(doc_id)
		}, {
			version: 1
		}, (error, docs) ->
			return callback(error) if error?
			if docs.length < 1 or !docs[0].version?
				return callback null, null
			else
				return callback null, docs[0].version

	setDocVersionInMongo: (doc_id, version, callback = (error) ->) ->
		db.docOps.update {
			doc_id: ObjectId(doc_id)
		}, {
			$set: version: version
		}, {
			upsert: true
		}, callback


			
