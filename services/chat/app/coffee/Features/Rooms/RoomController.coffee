async = require "async"
logger = require "logger-sharelatex"
AuthorizationManager = require "../Authorization/AuthorizationManager"
RoomManager = require "../Rooms/RoomManager"
SocketManager = require "../Sockets/SocketManager"

module.exports = RoomController =
	joinRoom: (client, data, callback = (error) ->) ->
		if !data.room?.project_id?
			return callback("unknown room")
		project_id = data.room.project_id

		client.get "id", (error, id) ->
			logger.log user_id: id, project_id: project_id, "joining room"
			AuthorizationManager.canClientJoinProjectRoom client, project_id, (error, authorized) ->
				return callback("something went wrong") if error?
				if authorized
					RoomManager.findOrCreateRoom project_id: project_id, (error, room) ->
						return callback("something went wrong") if error?
						room_id = room._id.toString()
						RoomController._addClientToRoom client, room_id, (error) ->
							return callback("something went wrong") if error?
							RoomController._getClientsInRoom room_id, (error, clients) ->
								return callback("something went wrong") if error?
								logger.log user_id: id, project_id: project_id, room_id: room_id, "joined room"
								roomDetails =
									room:
										id: room_id
										connectedUsers: clients
								callback null, roomDetails
				else
					logger.log user_id: id, project_id: project_id, "unauthorized attempt to join room"
					callback("unknown room")

	leaveAllRooms: (client, callback = (error) ->) ->
		client.get "id", (error, id) ->
			logger.log user_id: id, "leaving all rooms"
			SocketManager.getRoomIdsClientHasJoined client, (error, room_ids) ->
				return callback("something went wrong") if error?
				jobs = []
				for room_id in room_ids
					do (room_id) ->
						jobs.push (callback) ->
							RoomController.leaveRoom client, room_id, callback
				async.series jobs, (error)-> callback(error)
		
	leaveRoom: (client, room_id, callback = (error) ->) ->
		client.get "id", (error, id) ->
			logger.log user_id: id, room_id: room_id, "leaving room"
			RoomController._getClientAttributes client, (error, attributes) ->
				return callback("something went wrong") if error?
				SocketManager.removeClientFromRoom client, room_id, (error) ->
					return callback("something went wrong") if error?
					leftRoomUpdate =
						room:
							id: room_id
						user: attributes
					SocketManager.emitToRoom room_id, "userLeft", leftRoomUpdate
					logger.log user_id: id, room_id: room_id, "left room"
					callback()

	_addClientToRoom: (client, room_id, callback = (error) ->) ->
		RoomController._getClientAttributes client, (error, attributes) ->
			return callback(error) if error?
			update =
				room:
					id: room_id
				user: attributes
			SocketManager.emitToRoom room_id, "userJoined", update
			SocketManager.addClientToRoom client, room_id, callback

	_getClientsInRoom: (room_id, callback = (error, clients) ->) ->
		SocketManager.getClientsInRoom room_id, (error, clients) ->
			return callback(error) if error?
			formattedClients = []
			jobs = []

			for client in clients
				do (client) ->
					jobs.push (callback) ->
						RoomController._getClientAttributes client, (error, attributes) ->
							return callback(error) if error?
							formattedClients.push attributes
							callback()

			async.series jobs, (error) ->
				return callback(error) if error?
				callback null, formattedClients
	
	_getClientAttributes: (client, callback = (error, attributes) ->) ->
		SocketManager.getClientAttributes client, ["id", "first_name", "last_name", "email", "gravatar_url"], (error, attributes) ->
			return callback(error) if error?
			[id, first_name, last_name, email, gravatar_url] = attributes
			clientAttributes =
				id           : id
				first_name   : first_name
				last_name    : last_name
				email        : email
				gravatar_url : gravatar_url
			callback null, clientAttributes
		
