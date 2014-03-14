logger = require "logger-sharelatex"
metrics = require('../../infrastructure/Metrics')
Settings = require 'settings-sharelatex'
rclient = require("redis").createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
AutomaticSnapshotManager = require("../Versioning/AutomaticSnapshotManager")
EditorRealTimeController = require("./EditorRealTimeController")

module.exports = EditorUpdatesController =
	_applyUpdate: (client, project_id, doc_id, update, callback = (error) ->) ->
		metrics.inc "editor.doc-update", 0.3
		metrics.set "editor.active-projects", project_id, 0.3
		client.get "user_id", (error, user_id) ->
			metrics.set "editor.active-users", user_id, 0.3

		client.get "take_snapshots", (error, takeSnapshot) ->
			if takeSnapshot
				AutomaticSnapshotManager.markProjectAsUpdated(project_id)

		logger.log doc_id: doc_id, project_id: project_id, client_id: update.meta.source, version: update.v, "sending update to doc updater"

		DocumentUpdaterHandler.queueChange project_id, doc_id, update, (error) ->
			if error?
				logger.error err:error, project_id: project_id, doc_id: doc_id, client_id: update.meta.source, version: update.v, "document was not available for update"
				client.disconnect()
			callback(error)

	applyOtUpdate: (client, project_id, doc_id, update) ->
		update.meta ||= {}
		update.meta.source = client.id
		client.get "user_id", (error, user_id) ->
			update.meta.user_id = user_id
			EditorUpdatesController._applyUpdate client, project_id, doc_id, update

	applyAceUpdate: (client, project_id, doc_id, window_name, update) ->
		# This is deprecated now and should never be used. Kick the client off if they call it.
		# After the initial deploy this can be removed safely
		logger.err project_id: project_id, doc_id: doc_id, "client using old Ace Update method"
		client.disconnect()
		
	listenForUpdatesFromDocumentUpdater: () ->
		rclient.subscribe "applied-ops"
		rclient.on "message", @_processMessageFromDocumentUpdater.bind(@)
		
	_processMessageFromDocumentUpdater: (channel, message) ->
		message = JSON.parse message
		if message.op?
			@_applyUpdateFromDocumentUpdater(message.doc_id, message.op)
		else if message.error?
			@_processErrorFromDocumentUpdater(message.doc_id, message.error, message)

	_applyUpdateFromDocumentUpdater: (doc_id, update) ->
		io = require('../../infrastructure/Server').io
		logger.log doc_id: doc_id, version: update.v, source: update.meta.source, "distributing update"
		for client in io.sockets.clients(doc_id)
			if client.id == update.meta.source
				client.emit "otUpdateApplied", v: update.v, doc: update.doc
			else
				client.emit "otUpdateApplied", update

	_processErrorFromDocumentUpdater: (doc_id, error, message) ->
		io = require('../../infrastructure/Server').io
		logger.error err: error, doc_id: doc_id, "error from document updater"
		for client in io.sockets.clients(doc_id)
			client.emit "otUpdateError", error, message
			client.disconnect()




