import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import RedisClientManager from './RedisClientManager.js'
import SafeJsonParse from './SafeJsonParse.js'
import EventLogger from './EventLogger.js'
import HealthCheckManager from './HealthCheckManager.js'
import RoomManager from './RoomManager.js'
import ChannelManager from './ChannelManager.js'
import metrics from '@overleaf/metrics'

let DocumentUpdaterController

export default DocumentUpdaterController = {
  // DocumentUpdaterController is responsible for updates that come via Redis
  // Pub/Sub from the document updater.
  rclientList: RedisClientManager.createClientList(settings.redis.pubsub),

  listenForUpdatesFromDocumentUpdater(io) {
    logger.debug(
      { rclients: this.rclientList.length },
      'listening for applied-ops events'
    )
    for (const rclient of this.rclientList) {
      rclient.subscribe('applied-ops')
      rclient.on('message', function (channel, message) {
        metrics.inc('rclient', 0.001) // global event rate metric
        if (settings.debugEvents > 0) {
          EventLogger.debugEvent(channel, message)
        }
        DocumentUpdaterController._processMessageFromDocumentUpdater(
          io,
          channel,
          message
        )
      })
    }
    // create metrics for each redis instance only when we have multiple redis clients
    if (this.rclientList.length > 1) {
      this.rclientList.forEach((rclient, i) => {
        // per client event rate metric
        const metricName = `rclient-${i}`
        rclient.on('message', () => metrics.inc(metricName, 0.001))
      })
    }
    this.handleRoomUpdates(this.rclientList)
  },

  handleRoomUpdates(rclientSubList) {
    const roomEvents = RoomManager.eventSource()
    roomEvents.on('doc-active', function (docId) {
      const subscribePromises = rclientSubList.map(rclient =>
        ChannelManager.subscribe(rclient, 'applied-ops', docId)
      )
      RoomManager.emitOnCompletion(subscribePromises, `doc-subscribed-${docId}`)
    })
    roomEvents.on('doc-empty', docId =>
      rclientSubList.map(rclient =>
        ChannelManager.unsubscribe(rclient, 'applied-ops', docId)
      )
    )
  },

  _processMessageFromDocumentUpdater(io, channel, message) {
    SafeJsonParse.parse(message, function (error, message) {
      if (error) {
        logger.error({ err: error, channel }, 'error parsing JSON')
        return
      }
      if (message.health_check) {
        logger.debug(
          { message },
          'got health check message in applied ops channel'
        )
        HealthCheckManager.check(channel, message.key)
        return
      }
      // Messages on the legacy applied-ops channel are broadcast to the doc
      // room, matching the per-doc channel granularity.
      DocumentUpdaterController.handleAppliedOpMessage(
        io,
        message,
        message.doc_id
      )
    })
  },

  // Handle an already-parsed message from document-updater (an applied op
  // or an error) and broadcast it to the given room: the doc room for
  // messages from the legacy per-doc applied-ops channel, the project room
  // for messages forwarded from the editor-events channel by the
  // WebsocketLoadBalancer.
  handleAppliedOpMessage(io, message, roomId) {
    if (message.op) {
      if (message._id && settings.checkEventOrder) {
        const status = EventLogger.checkEventOrder(
          'applied-ops',
          message._id,
          message
        )
        if (status === 'duplicate') {
          return // skip duplicate events
        }
      }
      DocumentUpdaterController._applyUpdateFromDocumentUpdater(
        io,
        roomId,
        message.doc_id,
        message.op
      )
    } else if (message.error) {
      DocumentUpdaterController._processErrorFromDocumentUpdater(
        io,
        roomId,
        message.doc_id,
        message.error,
        message
      )
    }
  },

  _applyUpdateFromDocumentUpdater(io, roomId, docId, update) {
    let client
    const clientList = io.sockets.clients(roomId)
    // avoid unnecessary work if no clients are connected
    if (clientList.length === 0) {
      return
    }

    update.meta = update.meta || {}
    const { tsRT: realTimeIngestionTime } = update.meta
    delete update.meta.tsRT

    // send updates to clients
    logger.debug(
      {
        docId,
        version: update.v,
        source: update.meta && update.meta.source,
        socketIoClients: clientList.map(client => client.id),
      },
      'distributing updates to clients'
    )
    const seen = {}
    // send messages only to unique clients (due to duplicate entries in io.sockets.clients)
    for (client of clientList) {
      if (!seen[client.id]) {
        seen[client.id] = true
        if (client.publicId === update.meta.source) {
          logger.debug(
            {
              docId,
              version: update.v,
              source: update.meta.source,
            },
            'distributing update to sender'
          )
          metrics.histogram(
            'update-processing-time',
            performance.now() - realTimeIngestionTime,
            [
              0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 50, 100, 200, 500, 1000,
              2000, 5000, 10000,
            ],
            { path: 'sharejs' }
          )
          client.emit('otUpdateApplied', { v: update.v, doc: update.doc })
        } else if (!update.dup) {
          // Duplicate ops should just be sent back to sending client for acknowledgement
          logger.debug(
            {
              docId,
              version: update.v,
              source: update.meta.source,
              clientId: client.id,
            },
            'distributing update to collaborator'
          )
          client.emit('otUpdateApplied', update)
        }
      }
    }
    if (Object.keys(seen).length < clientList.length) {
      metrics.inc('socket-io.duplicate-clients', 0.1)
      logger.debug(
        {
          docId,
          socketIoClients: clientList.map(client => client.id),
        },
        'discarded duplicate clients'
      )
    }
  },

  _processErrorFromDocumentUpdater(io, roomId, docId, error, message) {
    for (const client of io.sockets.clients(roomId)) {
      // When broadcasting via the project room, only clients that have
      // joined the doc are affected by the error. (Always true for clients
      // in the doc room.)
      if (client.ol_context?.[`doc:${docId}`] !== 'allowed') {
        continue
      }
      logger.warn(
        { err: error, docId, clientId: client.id },
        'error from document updater, disconnecting client'
      )
      client.emit('otUpdateError', error, message)
      client.disconnect()
    }
  },
}
