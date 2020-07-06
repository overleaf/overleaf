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
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RoomManager
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const { EventEmitter } = require('events')

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

module.exports = RoomManager = {
  joinProject(client, project_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return this.joinEntity(client, 'project', project_id, callback)
  },

  joinDoc(client, doc_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return this.joinEntity(client, 'doc', doc_id, callback)
  },

  leaveDoc(client, doc_id) {
    return this.leaveEntity(client, 'doc', doc_id)
  },

  leaveProjectAndDocs(client) {
    // what rooms is this client in? we need to leave them all. socket.io
    // will cause us to leave the rooms, so we only need to manage our
    // channel subscriptions... but it will be safer if we leave them
    // explicitly, and then socket.io will just regard this as a client that
    // has not joined any rooms and do a final disconnection.
    const roomsToLeave = this._roomsClientIsIn(client)
    logger.log({ client: client.id, roomsToLeave }, 'client leaving project')
    return (() => {
      const result = []
      for (const id of Array.from(roomsToLeave)) {
        const entity = IdMap.get(id)
        result.push(this.leaveEntity(client, entity, id))
      }
      return result
    })()
  },

  emitOnCompletion(promiseList, eventName) {
    return Promise.all(promiseList)
      .then(() => RoomEvents.emit(eventName))
      .catch((err) => RoomEvents.emit(eventName, err))
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
      logger.log({ entity, id }, 'room is now active')
      RoomEvents.once(`${entity}-subscribed-${id}`, function (err) {
        // only allow the client to join when all the relevant channels have subscribed
        logger.log(
          { client: client.id, entity, id, beforeCount },
          'client joined new room and subscribed to channel'
        )
        return callback(err)
      })
      RoomEvents.emit(`${entity}-active`, id)
      IdMap.set(id, entity)
      // keep track of the number of listeners
      return metrics.gauge('room-listeners', RoomEvents.eventNames().length)
    } else {
      logger.log(
        { client: client.id, entity, id, beforeCount },
        'client joined existing room'
      )
      client.join(id)
      return callback()
    }
  },

  leaveEntity(client, entity, id) {
    // Ignore any requests to leave when the client is not actually in the
    // room. This can happen if the client sends spurious leaveDoc requests
    // for old docs after a reconnection.
    // This can now happen all the time, as we skip the join for clients that
    //  disconnect before joinProject/joinDoc completed.
    if (!this._clientAlreadyInRoom(client, id)) {
      logger.log(
        { client: client.id, entity, id },
        'ignoring request from client to leave room it is not in'
      )
      return
    }
    client.leave(id)
    const afterCount = this._clientsInRoom(client, id)
    logger.log(
      { client: client.id, entity, id, afterCount },
      'client left room'
    )
    // is the room now empty? if so, unsubscribe
    if (entity == null) {
      logger.error({ entity: id }, 'unknown entity when leaving with id')
      return
    }
    if (afterCount === 0) {
      logger.log({ entity, id }, 'room is now empty')
      RoomEvents.emit(`${entity}-empty`, id)
      IdMap.delete(id)
      return metrics.gauge('room-listeners', RoomEvents.eventNames().length)
    }
  },

  // internal functions below, these access socket.io rooms data directly and
  // will need updating for socket.io v2

  _clientsInRoom(client, room) {
    const nsp = client.namespace.name
    const name = nsp + '/' + room
    return (
      __guard__(
        client.manager != null ? client.manager.rooms : undefined,
        (x) => x[name]
      ) || []
    ).length
  },

  _roomsClientIsIn(client) {
    const roomList = (() => {
      const result = []
      for (const fullRoomPath in client.manager.roomClients != null
        ? client.manager.roomClients[client.id]
        : undefined) {
        // strip socket.io prefix from room to get original id
        if (fullRoomPath !== '') {
          const [prefix, room] = Array.from(fullRoomPath.split('/', 2))
          result.push(room)
        }
      }
      return result
    })()
    return roomList
  },

  _clientAlreadyInRoom(client, room) {
    const nsp = client.namespace.name
    const name = nsp + '/' + room
    return __guard__(
      client.manager.roomClients != null
        ? client.manager.roomClients[client.id]
        : undefined,
      (x) => x[name]
    )
  }
}
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
