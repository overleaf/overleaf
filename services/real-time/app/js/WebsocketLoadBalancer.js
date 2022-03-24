/* eslint-disable
    camelcase,
*/
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const RedisClientManager = require('./RedisClientManager')
const SafeJsonParse = require('./SafeJsonParse')
const EventLogger = require('./EventLogger')
const HealthCheckManager = require('./HealthCheckManager')
const RoomManager = require('./RoomManager')
const ChannelManager = require('./ChannelManager')
const ConnectedUsersManager = require('./ConnectedUsersManager')

const RESTRICTED_USER_MESSAGE_TYPE_PASS_LIST = [
  'connectionAccepted',
  'otUpdateApplied',
  'otUpdateError',
  'joinDoc',
  'reciveNewDoc',
  'reciveNewFile',
  'reciveNewFolder',
  'removeEntity',
  'accept-changes',
]

let WebsocketLoadBalancer
module.exports = WebsocketLoadBalancer = {
  rclientPubList: RedisClientManager.createClientList(Settings.redis.pubsub),
  rclientSubList: RedisClientManager.createClientList(Settings.redis.pubsub),

  emitToRoom(room_id, message, ...payload) {
    if (!room_id) {
      logger.warn(
        { message, payload },
        'no room_id provided, ignoring emitToRoom'
      )
      return
    }
    const data = JSON.stringify({
      room_id,
      message,
      payload,
    })
    logger.debug(
      { room_id, message, payload, length: data.length },
      'emitting to room'
    )

    this.rclientPubList.map(rclientPub =>
      ChannelManager.publish(rclientPub, 'editor-events', room_id, data)
    )
  },

  emitToAll(message, ...payload) {
    this.emitToRoom('all', message, ...payload)
  },

  listenForEditorEvents(io) {
    logger.debug(
      { rclients: this.rclientSubList.length },
      'listening for editor events'
    )
    for (const rclientSub of this.rclientSubList) {
      rclientSub.subscribe('editor-events')
      rclientSub.on('message', function (channel, message) {
        if (Settings.debugEvents > 0) {
          EventLogger.debugEvent(channel, message)
        }
        WebsocketLoadBalancer._processEditorEvent(io, channel, message)
      })
    }
    this.handleRoomUpdates(this.rclientSubList)
  },

  handleRoomUpdates(rclientSubList) {
    const roomEvents = RoomManager.eventSource()
    roomEvents.on('project-active', function (project_id) {
      const subscribePromises = rclientSubList.map(rclient =>
        ChannelManager.subscribe(rclient, 'editor-events', project_id)
      )
      RoomManager.emitOnCompletion(
        subscribePromises,
        `project-subscribed-${project_id}`
      )
    })
    roomEvents.on('project-empty', project_id =>
      rclientSubList.map(rclient =>
        ChannelManager.unsubscribe(rclient, 'editor-events', project_id)
      )
    )
  },

  _processEditorEvent(io, channel, message) {
    SafeJsonParse.parse(message, function (error, message) {
      if (error) {
        logger.error({ err: error, channel }, 'error parsing JSON')
        return
      }
      if (message.room_id === 'all') {
        io.sockets.emit(message.message, ...message.payload)
      } else if (
        message.message === 'clientTracking.refresh' &&
        message.room_id
      ) {
        const clientList = io.sockets.clients(message.room_id)
        logger.debug(
          {
            channel,
            message: message.message,
            room_id: message.room_id,
            message_id: message._id,
            socketIoClients: clientList.map(client => client.id),
          },
          'refreshing client list'
        )
        for (const client of clientList) {
          ConnectedUsersManager.refreshClient(message.room_id, client.publicId)
        }
      } else if (message.room_id) {
        if (message._id && Settings.checkEventOrder) {
          const status = EventLogger.checkEventOrder(
            'editor-events',
            message._id,
            message
          )
          if (status === 'duplicate') {
            return // skip duplicate events
          }
        }

        const is_restricted_message =
          !RESTRICTED_USER_MESSAGE_TYPE_PASS_LIST.includes(message.message)

        // send messages only to unique clients (due to duplicate entries in io.sockets.clients)
        const clientList = io.sockets
          .clients(message.room_id)
          .filter(
            client =>
              !(is_restricted_message && client.ol_context.is_restricted_user)
          )

        // avoid unnecessary work if no clients are connected
        if (clientList.length === 0) {
          return
        }
        logger.debug(
          {
            channel,
            message: message.message,
            room_id: message.room_id,
            message_id: message._id,
            socketIoClients: clientList.map(client => client.id),
          },
          'distributing event to clients'
        )
        const seen = new Map()
        for (const client of clientList) {
          if (!seen.has(client.id)) {
            seen.set(client.id, true)
            client.emit(message.message, ...message.payload)
          }
        }
      } else if (message.health_check) {
        logger.debug(
          { message },
          'got health check message in editor events channel'
        )
        HealthCheckManager.check(channel, message.key)
      }
    })
  },
}
