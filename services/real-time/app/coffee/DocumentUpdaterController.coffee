logger = require "logger-sharelatex"
settings = require 'settings-sharelatex'
redis = require("redis-sharelatex")
SafeJsonParse = require "./SafeJsonParse"
EventLogger = require "./EventLogger"
HealthCheckManager = require "./HealthCheckManager"
metrics = require "metrics-sharelatex"

MESSAGE_SIZE_LOG_LIMIT = 1024 * 1024 # 1Mb

module.exports = DocumentUpdaterController =
	# DocumentUpdaterController is responsible for updates that come via Redis
	# Pub/Sub from the document updater.
	rclientList: [redis.createClient(settings.redis.pubsub)]

	listenForUpdatesFromDocumentUpdater: (io) ->
		for rclient in @rclientList
			rclient.subscribe "applied-ops"
			rclient.on "message", (channel, message) ->
				metrics.inc "rclient", 0.001 # global event rate metric
				EventLogger.debugEvent(channel, message) if settings.debugEvents > 0
				DocumentUpdaterController._processMessageFromDocumentUpdater(io, channel, message)
		
	_processMessageFromDocumentUpdater: (io, channel, message) ->
		SafeJsonParse.parse message, (error, message) ->
			if error?
				logger.error {err: error, channel}, "error parsing JSON"
				return
			if message.op?
				if message._id?
					status = EventLogger.checkEventOrder("applied-ops", message._id, message)
					if status is 'duplicate'
						return # skip duplicate events
				DocumentUpdaterController._applyUpdateFromDocumentUpdater(io, message.doc_id, message.op)
			else if message.error?
				DocumentUpdaterController._processErrorFromDocumentUpdater(io, message.doc_id, message.error, message)
			else if message.health_check?
				logger.debug {message}, "got health check message in applied ops channel"
				HealthCheckManager.check channel, message.key

	_applyUpdateFromDocumentUpdater: (io, doc_id, update) ->
		clientList = io.sockets.clients(doc_id)
		# avoid unnecessary work if no clients are connected
		if clientList.length is 0
			return
		# send updates to clients
		logger.log doc_id: doc_id, version: update.v, source: update.meta?.source, socketIoClients: (client.id for client in clientList), "distributing updates to clients"
		seen = {}
		# send messages only to unique clients (due to duplicate entries in io.sockets.clients)
		for client in clientList when not seen[client.id]
			seen[client.id] = true
			if client.id == update.meta.source
				logger.log doc_id: doc_id, version: update.v, source: update.meta?.source, "distributing update to sender"
				client.emit "otUpdateApplied", v: update.v, doc: update.doc
			else if !update.dup # Duplicate ops should just be sent back to sending client for acknowledgement
				logger.log doc_id: doc_id, version: update.v, source: update.meta?.source, client_id: client.id, "distributing update to collaborator"
				client.emit "otUpdateApplied", update
		if Object.keys(seen).length < clientList.length
			metrics.inc "socket-io.duplicate-clients", 0.1
			logger.log doc_id: doc_id, socketIoClients: (client.id for client in clientList), "discarded duplicate clients"

	_processErrorFromDocumentUpdater: (io, doc_id, error, message) ->
		for client in io.sockets.clients(doc_id)
			logger.warn err: error, doc_id: doc_id, client_id: client.id, "error from document updater, disconnecting client"
			client.emit "otUpdateError", error, message
			client.disconnect()


