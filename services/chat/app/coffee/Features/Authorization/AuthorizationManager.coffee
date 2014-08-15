WebApiManager = require "../WebApi/WebApiManager"
SocketManager = require "../Sockets/SocketManager"

module.exports = AuthorizationManager =
	canClientJoinProjectRoom: (client, project_id, callback = (error, authorized) ->) ->
		client.get "auth_token", (error, auth_token) ->
			return callback(error) if error?
			WebApiManager.getProjectCollaborators project_id, auth_token, (error, collaborators) ->
				return callback(error) if error?
				client.get "id", (error, user_id) ->
					return callback(error) if error?
					authorized = false
					for collaborator in collaborators
						if collaborator.id == user_id
							authorized = true
							break
					callback null, authorized

	canClientSendMessageToRoom: (client, room_id, callback = (error, authorized) ->) ->
		SocketManager.isClientInRoom(client, room_id, callback)

	canClientReadMessagesInRoom: (client, room_id, callback = (error, authorized) ->) ->
		SocketManager.isClientInRoom(client, room_id, callback)
				
