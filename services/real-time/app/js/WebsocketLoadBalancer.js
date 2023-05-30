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

  shouldDisconnectClient(client, message) {
    const userId = client.ol_context.user_id
    if (message?.message === 'userRemovedFromProject') {
      if (message?.payload?.includes(userId)) {
        return true
      }
    } else if (message?.message === 'project:publicAccessLevel:changed') {
      const [info] = message.payload
      if (
        info.newAccessLevel === 'private' &&
        !client.ol_context.is_invited_member
      ) {
        return true
      }
    }
    return false
  },

  emitToRoom(roomId, message, ...payload) {
    if (!roomId) {
      logger.warn(
        { message, payload },
        'no room_id provided, ignoring emitToRoom'
      )
      return
    }
    const data = JSON.stringify({
      room_id: roomId,
      message,
      payload,
    })
    logger.debug(
      { roomId, message, payload, length: data.length },
      'emitting to room'
    )

    this.rclientPubList.map(rclientPub =>
      ChannelManager.publish(rclientPub, 'editor-events', roomId, data)
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
    roomEvents.on('project-active', function (projectId) {
      const subscribePromises = rclientSubList.map(rclient =>
        ChannelManager.subscribe(rclient, 'editor-events', projectId)
      )
      RoomManager.emitOnCompletion(
        subscribePromises,
        `project-subscribed-${projectId}`
      )
    })
    roomEvents.on('project-empty', projectId =>
      rclientSubList.map(rclient =>
        ChannelManager.unsubscribe(rclient, 'editor-events', projectId)
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
            roomId: message.room_id,
            messageId: message._id,
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

        const isRestrictedMessage =
          !RESTRICTED_USER_MESSAGE_TYPE_PASS_LIST.includes(message.message)

        // send messages only to unique clients (due to duplicate entries in io.sockets.clients)
        const clientList = io.sockets.clients(message.room_id)

        // avoid unnecessary work if no clients are connected
        if (clientList.length === 0) {
          return
        }
        logger.debug(
          {
            channel,
            message: message.message,
            roomId: message.room_id,
            messageId: message._id,
            socketIoClients: clientList.map(client => client.id),
          },
          'distributing event to clients'
        )
        const seen = new Map()
        for (const client of clientList) {
          if (!seen.has(client.id)) {
            seen.set(client.id, true)
            if (WebsocketLoadBalancer.shouldDisconnectClient(client, message)) {
              logger.debug(
                {
                  message,
                  userId: client?.ol_context?.user_id,
                  projectId: client?.ol_context?.project_id,
                },
                'disconnecting client'
              )
              client.emit('project:access:revoked')
              client.disconnect()
            } else {
              if (
                !(isRestrictedMessage && client.ol_context.is_restricted_user)
              ) {
                client.emit(message.message, ...message.payload)
              }
            }
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
