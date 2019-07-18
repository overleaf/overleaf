logger = require 'logger-sharelatex'
{EventEmitter} = require 'events'

IdMap = new Map() # keep track of whether ids are from projects or docs
RoomEvents = new EventEmitter()

# Manage socket.io rooms for individual projects and docs
#
# The first time someone joins a project or doc we emit a 'project-active' or
# 'doc-active' event.
#
# When the last person leaves a project or doc, we emit 'project-empty' or
# 'doc-empty' event.
#
# The pubsub side is handled by ChannelManager

module.exports = RoomManager =

    joinProject: (client, project_id) ->
        @_join client, "project", project_id

    joinDoc: (client, doc_id) ->
        @_join client, "doc", doc_id

    leaveDoc: (client, doc_id) ->
        @_leave client, "doc", doc_id

    leaveProjectAndDocs: (client) ->
        # what rooms is this client in? we need to leave them all
        for id in @_roomsClientIsIn(client)
            entity = IdMap.get(id)
            @_leave client, entity, id

    eventSource: () ->
        return RoomEvents

    _clientsInRoom: (client, room) ->
        nsp = client.namespace.name
        name = (nsp + '/') + room;
        return (client.manager?.rooms?[name] || []).length

    _roomsClientIsIn: (client) ->
        roomList = for fullRoomPath of client.manager.roomClients?[client.id] when fullRoomPath isnt ''
            # strip socket.io prefix from room to get original id
            [prefix, room] = fullRoomPath.split('/', 2)
            room
        return roomList

    _join: (client, entity, id) ->
        beforeCount = @_clientsInRoom(client, id)
        client.join id
        afterCount = @_clientsInRoom(client, id)
        logger.log {client: client.id, entity, id, beforeCount, afterCount}, "client joined room"
        # is this a new room? if so, subscribe
        if beforeCount == 0 and afterCount == 1
            logger.log {entity, id}, "room is now active"
            RoomEvents.emit "#{entity}-active", id
            IdMap.set(id, entity)

    _leave: (client, entity, id) ->
        beforeCount = @_clientsInRoom(client, id)
        client.leave id
        afterCount = @_clientsInRoom(client, id)
        logger.log {client: client.id, entity, id, beforeCount, afterCount}, "client left room"
        # is the room now empty? if so, unsubscribe
        if beforeCount == 1 and afterCount == 0
            logger.log {entity, id}, "room is now empty"
            RoomEvents.emit "#{entity}-empty", id
            IdMap.delete(id)