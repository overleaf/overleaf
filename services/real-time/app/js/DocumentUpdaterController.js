/* eslint-disable
    camelcase,
*/
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const RedisClientManager = require('./RedisClientManager')
const SafeJsonParse = require('./SafeJsonParse')
const EventLogger = require('./EventLogger')
const HealthCheckManager = require('./HealthCheckManager')
const RoomManager = require('./RoomManager')
const ChannelManager = require('./ChannelManager')
const metrics = require('metrics-sharelatex')

let DocumentUpdaterController
module.exports = DocumentUpdaterController = {
  // DocumentUpdaterController is responsible for updates that come via Redis
  // Pub/Sub from the document updater.
  rclientList: RedisClientManager.createClientList(settings.redis.pubsub),

  listenForUpdatesFromDocumentUpdater(io) {
    logger.log(
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
    roomEvents.on('doc-active', function (doc_id) {
      const subscribePromises = rclientSubList.map((rclient) =>
        ChannelManager.subscribe(rclient, 'applied-ops', doc_id)
      )
      RoomManager.emitOnCompletion(
        subscribePromises,
        `doc-subscribed-${doc_id}`
      )
    })
    roomEvents.on('doc-empty', (doc_id) =>
      rclientSubList.map((rclient) =>
        ChannelManager.unsubscribe(rclient, 'applied-ops', doc_id)
      )
    )
  },

  _processMessageFromDocumentUpdater(io, channel, message) {
    SafeJsonParse.parse(message, function (error, message) {
      if (error) {
        logger.error({ err: error, channel }, 'error parsing JSON')
        return
      }
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
          message.doc_id,
          message.op
        )
      } else if (message.error) {
        DocumentUpdaterController._processErrorFromDocumentUpdater(
          io,
          message.doc_id,
          message.error,
          message
        )
      } else if (message.health_check) {
        logger.debug(
          { message },
          'got health check message in applied ops channel'
        )
        HealthCheckManager.check(channel, message.key)
      }
    })
  },

  _applyUpdateFromDocumentUpdater(io, doc_id, update) {
    let client
    const clientList = io.sockets.clients(doc_id)
    // avoid unnecessary work if no clients are connected
    if (clientList.length === 0) {
      return
    }
    // send updates to clients
    logger.log(
      {
        doc_id,
        version: update.v,
        source: update.meta && update.meta.source,
        socketIoClients: clientList.map((client) => client.id)
      },
      'distributing updates to clients'
    )
    const seen = {}
    // send messages only to unique clients (due to duplicate entries in io.sockets.clients)
    for (client of clientList) {
      if (!seen[client.id]) {
        seen[client.id] = true
        if (client.publicId === update.meta.source) {
          logger.log(
            {
              doc_id,
              version: update.v,
              source: update.meta.source
            },
            'distributing update to sender'
          )
          client.emit('otUpdateApplied', { v: update.v, doc: update.doc })
        } else if (!update.dup) {
          // Duplicate ops should just be sent back to sending client for acknowledgement
          logger.log(
            {
              doc_id,
              version: update.v,
              source: update.meta.source,
              client_id: client.id
            },
            'distributing update to collaborator'
          )
          client.emit('otUpdateApplied', update)
        }
      }
    }
    if (Object.keys(seen).length < clientList.length) {
      metrics.inc('socket-io.duplicate-clients', 0.1)
      logger.log(
        {
          doc_id,
          socketIoClients: clientList.map((client) => client.id)
        },
        'discarded duplicate clients'
      )
    }
  },

  _processErrorFromDocumentUpdater(io, doc_id, error, message) {
    for (const client of io.sockets.clients(doc_id)) {
      logger.warn(
        { err: error, doc_id, client_id: client.id },
        'error from document updater, disconnecting client'
      )
      client.emit('otUpdateError', error, message)
      client.disconnect()
    }
  }
}
