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
        @joinEntity client, "project", project_id

    joinDoc: (client, doc_id) ->
        @joinEntity client, "doc", doc_id

    leaveDoc: (client, doc_id) ->
        @leaveEntity client, "doc", doc_id

    leaveProjectAndDocs: (client) ->
        # what rooms is this client in? we need to leave them all. socket.io
        # will cause us to leave the rooms, so we only need to manage our
        # channel subscriptions... but it will be safer if we leave them
        # explicitly, and then socket.io will just regard this as a client that
        # has not joined any rooms and do a final disconnection.
        for id in @_roomsClientIsIn(client)
            entity = IdMap.get(id)
            @leaveEntity client, entity, id

    eventSource: () ->
        return RoomEvents

    joinEntity: (client, entity, id) ->
        beforeCount = @_clientsInRoom(client, id)
        client.join id
        afterCount = @_clientsInRoom(client, id)
        logger.log {client: client.id, entity, id, beforeCount, afterCount}, "client joined room"
        # is this a new room? if so, subscribe
        if beforeCount == 0 and afterCount == 1
            logger.log {entity, id}, "room is now active"
            RoomEvents.emit "#{entity}-active", id
            IdMap.set(id, entity)

    leaveEntity: (client, entity, id) ->
        beforeCount = @_clientsInRoom(client, id)
        client.leave id
        afterCount = @_clientsInRoom(client, id)
        logger.log {client: client.id, entity, id, beforeCount, afterCount}, "client left room"
        # is the room now empty? if so, unsubscribe
        if !entity?
            logger.error {entity: id}, "unknown entity when leaving with id"
            return
        if beforeCount == 1 and afterCount == 0
            logger.log {entity, id}, "room is now empty"
            RoomEvents.emit "#{entity}-empty", id
            IdMap.delete(id)

    # internal functions below, these access socket.io rooms data directly and
    # will need updating for socket.io v2

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
