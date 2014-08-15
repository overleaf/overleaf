async = require "async"
RealTimeEventManager = require("./RealTimeEventManager")

module.exports = SocketManager =
	addClientToRoom: (client, room_id, callback = (error) ->) ->
		client.join(room_id)
		callback()

	removeClientFromRoom: (client, room_id, callback = (error) ->) ->
		client.leave(room_id)
		callback()
	
	getClientAttributes: (client, attributes, callback = (error, values) ->) ->
		jobs = []
		for attribute in attributes
			do (attribute) ->
				jobs.push (cb) -> client.get attribute, cb
		async.series jobs, callback

	emitToRoom: RealTimeEventManager.emitToRoom

	isClientInRoom: (targetClient, room_id, callback = (error, inRoom) ->) ->
		io = require("../../server").io
		for client in io.sockets.clients(room_id)
			if client.id == targetClient.id
				return callback null, true
		callback null, false

	getClientsInRoom: (room_id, callback = (error, clients) ->) ->
		io = require("../../server").io
		callback null, io.sockets.clients(room_id)

	getRoomIdsClientHasJoined: (client, callback = (error, room_ids) ->) ->
		io = require("../../server").io
		room_ids = []
		for room_id, value of io.sockets.manager.roomClients[client.id]
			if room_id[0] == "/"
				room_ids.push room_id.slice(1)
		callback null, room_ids
		
