import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import { EventEmitter } from 'node:events'
import OError from '@overleaf/o-error'

const IdMap = new Map() // keep track of whether ids are from projects or docs
const RoomEvents = new EventEmitter() // emits {project,doc}-active and {project,doc}-empty events

// Manage socket.io rooms for individual projects and docs
//
// The first time someone joins a project or doc we emit a 'project-active' or
// 'doc-active' event.
//
// When the last person leaves a project or doc, we emit 'project-empty' or
// 'doc-empty' event.
//
// The pubsub side is handled by ChannelManager

export default {
  joinProject(client, projectId, callback) {
    this.joinEntity(client, 'project', projectId, callback)
  },

  joinDoc(client, docId, callback) {
    this.joinEntity(client, 'doc', docId, callback)
  },

  leaveDoc(client, docId) {
    this.leaveEntity(client, 'doc', docId)
  },

  leaveProjectAndDocs(client) {
    // what rooms is this client in? we need to leave them all. socket.io
    // will cause us to leave the rooms, so we only need to manage our
    // channel subscriptions... but it will be safer if we leave them
    // explicitly, and then socket.io will just regard this as a client that
    // has not joined any rooms and do a final disconnection.
    const roomsToLeave = this._roomsClientIsIn(client)
    logger.debug({ client: client.id, roomsToLeave }, 'client leaving project')
    for (const id of roomsToLeave) {
      const entity = IdMap.get(id)
      this.leaveEntity(client, entity, id)
    }
  },

  emitOnCompletion(promiseList, eventName) {
    Promise.all(promiseList)
      .then(() => RoomEvents.emit(eventName))
      .catch(err => RoomEvents.emit(eventName, err))
  },

  eventSource() {
    return RoomEvents
  },

  joinEntity(client, entity, id, callback) {
    const beforeCount = this._clientsInRoom(client, id)
    // client joins room immediately but joinDoc request does not complete
    // until room is subscribed
    client.join(id)
    // is this a new room? if so, subscribe
    if (beforeCount === 0) {
      logger.debug({ entity, id }, 'room is now active')
      RoomEvents.once(`${entity}-subscribed-${id}`, function (err) {
        // only allow the client to join when all the relevant channels have subscribed
        if (err) {
          OError.tag(err, 'error joining', { entity, id })
          return callback(err)
        }
        logger.debug(
          { client: client.id, entity, id, beforeCount },
          'client joined new room and subscribed to channel'
        )
        callback(err)
      })
      RoomEvents.emit(`${entity}-active`, id)
      IdMap.set(id, entity)
      // keep track of the number of listeners
      metrics.gauge('room-listeners', RoomEvents.eventNames().length)
    } else {
      logger.debug(
        { client: client.id, entity, id, beforeCount },
        'client joined existing room'
      )
      callback()
    }
  },

  leaveEntity(client, entity, id) {
    // Ignore any requests to leave when the client is not actually in the
    // room. This can happen if the client sends spurious leaveDoc requests
    // for old docs after a reconnection.
    // This can now happen all the time, as we skip the join for clients that
    //  disconnect before joinProject/joinDoc completed.
    if (!this._clientAlreadyInRoom(client, id)) {
      logger.debug(
        { client: client.id, entity, id },
        'ignoring request from client to leave room it is not in'
      )
      return
    }
    client.leave(id)
    const afterCount = this._clientsInRoom(client, id)
    logger.debug(
      { client: client.id, entity, id, afterCount },
      'client left room'
    )
    // is the room now empty? if so, unsubscribe
    if (!entity) {
      logger.error({ entity: id }, 'unknown entity when leaving with id')
      return
    }
    if (afterCount === 0) {
      logger.debug({ entity, id }, 'room is now empty')
      RoomEvents.emit(`${entity}-empty`, id)
      IdMap.delete(id)
      metrics.gauge('room-listeners', RoomEvents.eventNames().length)
    }
  },

  // internal functions below, these access socket.io rooms data directly and
  // will need updating for socket.io v2

  // The below code makes some assumptions that are always true for v0
  // - we are using the base namespace '', so room names are '/<ENTITY>'
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/manager.js#L62
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/manager.js#L1018
  // - client.namespace is a Namespace
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/namespace.js#L204
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/socket.js#L40
  // - client.manager is a Manager
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/namespace.js#L204
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/socket.js#L41
  // - a Manager has
  //   - `.rooms={'NAMESPACE/ENTITY': []}` and
  //   - `.roomClients={'CLIENT_ID': {'...': true}}`
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/manager.js#L287-L288
  //   https://github.com/socketio/socket.io/blob/e4d61b1be65ac3313a85da111a46777aa8d4aae3/lib/manager.js#L444-L455

  _clientsInRoom(client, room) {
    const clients = client.manager.rooms['/' + room] || []
    return clients.length
  },

  _roomsClientIsIn(client) {
    const rooms = client.manager.roomClients[client.id] || {}
    return (
      Object.keys(rooms)
        // drop the namespace
        .filter(room => room !== '')
        // room names are composed as '<NAMESPACE>/<ROOM>' and the default
        //  namespace is empty (see comments above), just drop the '/'
        .map(fullRoomPath => fullRoomPath.slice(1))
    )
  },

  _clientAlreadyInRoom(client, room) {
    const rooms = client.manager.roomClients[client.id] || {}
    return !!rooms['/' + room]
  },
}
