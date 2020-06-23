/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let WebsocketLoadBalancer;
const Settings = require('settings-sharelatex');
const logger = require('logger-sharelatex');
const RedisClientManager = require("./RedisClientManager");
const SafeJsonParse = require("./SafeJsonParse");
const EventLogger = require("./EventLogger");
const HealthCheckManager = require("./HealthCheckManager");
const RoomManager = require("./RoomManager");
const ChannelManager = require("./ChannelManager");
const ConnectedUsersManager = require("./ConnectedUsersManager");

const RESTRICTED_USER_MESSAGE_TYPE_PASS_LIST = [
	'connectionAccepted',
	'otUpdateApplied',
	'otUpdateError',
	'joinDoc',
	'reciveNewDoc',
	'reciveNewFile',
	'reciveNewFolder',
	'removeEntity'
];

module.exports = (WebsocketLoadBalancer = {
	rclientPubList: RedisClientManager.createClientList(Settings.redis.pubsub),
	rclientSubList: RedisClientManager.createClientList(Settings.redis.pubsub),

	emitToRoom(room_id, message, ...payload) {
		if ((room_id == null)) {
			logger.warn({message, payload}, "no room_id provided, ignoring emitToRoom");
			return;
		}
		const data = JSON.stringify({
			room_id,
			message,
			payload
		});
		logger.log({room_id, message, payload, length: data.length}, "emitting to room");

		return Array.from(this.rclientPubList).map((rclientPub) =>
			ChannelManager.publish(rclientPub, "editor-events", room_id, data));
	},

	emitToAll(message, ...payload) {
		return this.emitToRoom("all", message, ...Array.from(payload));
	},

	listenForEditorEvents(io) {
		logger.log({rclients: this.rclientPubList.length}, "publishing editor events");
		logger.log({rclients: this.rclientSubList.length}, "listening for editor events");
		for (let rclientSub of Array.from(this.rclientSubList)) {
			rclientSub.subscribe("editor-events");
			rclientSub.on("message", function(channel, message) {
				if (Settings.debugEvents > 0) { EventLogger.debugEvent(channel, message); }
				return WebsocketLoadBalancer._processEditorEvent(io, channel, message);
			});
		}
		return this.handleRoomUpdates(this.rclientSubList);
	},

	handleRoomUpdates(rclientSubList) {
		const roomEvents = RoomManager.eventSource();
		roomEvents.on('project-active', function(project_id) {
			const subscribePromises = Array.from(rclientSubList).map((rclient) =>
				ChannelManager.subscribe(rclient, "editor-events", project_id));
			return RoomManager.emitOnCompletion(subscribePromises, `project-subscribed-${project_id}`);
		});
		return roomEvents.on('project-empty', project_id => Array.from(rclientSubList).map((rclient) =>
            ChannelManager.unsubscribe(rclient, "editor-events", project_id)));
	},

	_processEditorEvent(io, channel, message) {
		return SafeJsonParse.parse(message, function(error, message) {
			let clientList;
			let client;
			if (error != null) {
				logger.error({err: error, channel}, "error parsing JSON");
				return;
			}
			if (message.room_id === "all") {
				return io.sockets.emit(message.message, ...Array.from(message.payload));
			} else if ((message.message === 'clientTracking.refresh') && (message.room_id != null)) {
				clientList = io.sockets.clients(message.room_id);
				logger.log({channel, message: message.message, room_id: message.room_id, message_id: message._id, socketIoClients: ((() => {
					const result = [];
					for (client of Array.from(clientList)) { 						result.push(client.id);
					}
					return result;
				})())}, "refreshing client list");
				return (() => {
					const result1 = [];
					for (client of Array.from(clientList)) {
						result1.push(ConnectedUsersManager.refreshClient(message.room_id, client.publicId));
					}
					return result1;
				})();
			} else if (message.room_id != null) {
				if ((message._id != null) && Settings.checkEventOrder) {
					const status = EventLogger.checkEventOrder("editor-events", message._id, message);
					if (status === "duplicate") {
						return; // skip duplicate events
					}
				}

				const is_restricted_message = !Array.from(RESTRICTED_USER_MESSAGE_TYPE_PASS_LIST).includes(message.message);

				// send messages only to unique clients (due to duplicate entries in io.sockets.clients)
				clientList = io.sockets.clients(message.room_id)
				.filter(client => !(is_restricted_message && client.ol_context['is_restricted_user']));

				// avoid unnecessary work if no clients are connected
				if (clientList.length === 0) { return; }
				logger.log({
					channel,
					message: message.message,
					room_id: message.room_id,
					message_id: message._id,
					socketIoClients: ((() => {
						const result2 = [];
						for (client of Array.from(clientList)) { 							result2.push(client.id);
						}
						return result2;
					})())
				}, "distributing event to clients");
				const seen = {};
				return (() => {
					const result3 = [];
					for (client of Array.from(clientList)) {
						if (!seen[client.id]) {
							seen[client.id] = true;
							result3.push(client.emit(message.message, ...Array.from(message.payload)));
						} else {
							result3.push(undefined);
						}
					}
					return result3;
				})();
			} else if (message.health_check != null) {
				logger.debug({message}, "got health check message in editor events channel");
				return HealthCheckManager.check(channel, message.key);
			}
		});
	}
});
