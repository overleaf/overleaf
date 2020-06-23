/* eslint-disable
    camelcase,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocumentUpdaterController;
const logger = require("logger-sharelatex");
const settings = require('settings-sharelatex');
const RedisClientManager = require("./RedisClientManager");
const SafeJsonParse = require("./SafeJsonParse");
const EventLogger = require("./EventLogger");
const HealthCheckManager = require("./HealthCheckManager");
const RoomManager = require("./RoomManager");
const ChannelManager = require("./ChannelManager");
const metrics = require("metrics-sharelatex");

const MESSAGE_SIZE_LOG_LIMIT = 1024 * 1024; // 1Mb

module.exports = (DocumentUpdaterController = {
	// DocumentUpdaterController is responsible for updates that come via Redis
	// Pub/Sub from the document updater.
	rclientList: RedisClientManager.createClientList(settings.redis.pubsub),

	listenForUpdatesFromDocumentUpdater(io) {
		let i, rclient;
		logger.log({rclients: this.rclientList.length}, "listening for applied-ops events");
		for (i = 0; i < this.rclientList.length; i++) {
			rclient = this.rclientList[i];
			rclient.subscribe("applied-ops");
			rclient.on("message", function(channel, message) {
				metrics.inc("rclient", 0.001); // global event rate metric
				if (settings.debugEvents > 0) { EventLogger.debugEvent(channel, message); }
				return DocumentUpdaterController._processMessageFromDocumentUpdater(io, channel, message);
			});
		}
		// create metrics for each redis instance only when we have multiple redis clients
		if (this.rclientList.length > 1) {
			for (i = 0; i < this.rclientList.length; i++) {
				rclient = this.rclientList[i];
				((i => // per client event rate metric
                rclient.on("message", () => metrics.inc(`rclient-${i}`, 0.001))))(i);
			}
		}
		return this.handleRoomUpdates(this.rclientList);
	},

	handleRoomUpdates(rclientSubList) {
		const roomEvents = RoomManager.eventSource();
		roomEvents.on('doc-active', function(doc_id) {
			const subscribePromises = Array.from(rclientSubList).map((rclient) =>
				ChannelManager.subscribe(rclient, "applied-ops", doc_id));
			return RoomManager.emitOnCompletion(subscribePromises, `doc-subscribed-${doc_id}`);
		});
		return roomEvents.on('doc-empty', doc_id => Array.from(rclientSubList).map((rclient) =>
            ChannelManager.unsubscribe(rclient, "applied-ops", doc_id)));
	},

	_processMessageFromDocumentUpdater(io, channel, message) {
		return SafeJsonParse.parse(message, function(error, message) {
			if (error != null) {
				logger.error({err: error, channel}, "error parsing JSON");
				return;
			}
			if (message.op != null) {
				if ((message._id != null) && settings.checkEventOrder) {
					const status = EventLogger.checkEventOrder("applied-ops", message._id, message);
					if (status === 'duplicate') {
						return; // skip duplicate events
					}
				}
				return DocumentUpdaterController._applyUpdateFromDocumentUpdater(io, message.doc_id, message.op);
			} else if (message.error != null) {
				return DocumentUpdaterController._processErrorFromDocumentUpdater(io, message.doc_id, message.error, message);
			} else if (message.health_check != null) {
				logger.debug({message}, "got health check message in applied ops channel");
				return HealthCheckManager.check(channel, message.key);
			}
		});
	},

	_applyUpdateFromDocumentUpdater(io, doc_id, update) {
		let client;
		const clientList = io.sockets.clients(doc_id);
		// avoid unnecessary work if no clients are connected
		if (clientList.length === 0) {
			return;
		}
		// send updates to clients
		logger.log({doc_id, version: update.v, source: (update.meta != null ? update.meta.source : undefined), socketIoClients: (((() => {
			const result = [];
			for (client of Array.from(clientList)) { 				result.push(client.id);
			}
			return result;
		})()))}, "distributing updates to clients");
		const seen = {};
		// send messages only to unique clients (due to duplicate entries in io.sockets.clients)
		for (client of Array.from(clientList)) {
			if (!seen[client.id]) {
				seen[client.id] = true;
				if (client.publicId === update.meta.source) {
					logger.log({doc_id, version: update.v, source: (update.meta != null ? update.meta.source : undefined)}, "distributing update to sender");
					client.emit("otUpdateApplied", {v: update.v, doc: update.doc});
				} else if (!update.dup) { // Duplicate ops should just be sent back to sending client for acknowledgement
					logger.log({doc_id, version: update.v, source: (update.meta != null ? update.meta.source : undefined), client_id: client.id}, "distributing update to collaborator");
					client.emit("otUpdateApplied", update);
				}
			}
		}
		if (Object.keys(seen).length < clientList.length) {
			metrics.inc("socket-io.duplicate-clients", 0.1);
			return logger.log({doc_id, socketIoClients: (((() => {
				const result1 = [];
				for (client of Array.from(clientList)) { 					result1.push(client.id);
				}
				return result1;
			})()))}, "discarded duplicate clients");
		}
	},

	_processErrorFromDocumentUpdater(io, doc_id, error, message) {
		return (() => {
			const result = [];
			for (const client of Array.from(io.sockets.clients(doc_id))) {
				logger.warn({err: error, doc_id, client_id: client.id}, "error from document updater, disconnecting client");
				client.emit("otUpdateError", error, message);
				result.push(client.disconnect());
			}
			return result;
		})();
	}
});


