const logger = require('logger-sharelatex')

module.exports = {
  startDrainTimeWindow(io, minsToDrain) {
    const drainPerMin = io.sockets.clients().length / minsToDrain
    // enforce minimum drain rate
    this.startDrain(io, Math.max(drainPerMin / 60, 4))
  },

  startDrain(io, rate) {
    // Clear out any old interval
    clearInterval(this.interval)
    logger.log({ rate }, 'starting drain')
    if (rate === 0) {
      return
    }
    let pollingInterval
    if (rate < 1) {
      // allow lower drain rates
      // e.g. rate=0.1 will drain one client every 10 seconds
      pollingInterval = 1000 / rate
      rate = 1
    } else {
      pollingInterval = 1000
    }
    this.interval = setInterval(() => {
      this.reconnectNClients(io, rate)
    }, pollingInterval)
  },

  RECONNECTED_CLIENTS: {},
  reconnectNClients(io, N) {
    let drainedCount = 0
    for (const client of io.sockets.clients()) {
      if (!this.RECONNECTED_CLIENTS[client.id]) {
        this.RECONNECTED_CLIENTS[client.id] = true
        logger.log(
          { client_id: client.id },
          'Asking client to reconnect gracefully'
        )
        client.emit('reconnectGracefully')
        drainedCount++
      }
      const haveDrainedNClients = drainedCount === N
      if (haveDrainedNClients) {
        break
      }
    }
    if (drainedCount < N) {
      logger.log('All clients have been told to reconnectGracefully')
    }
  }
}
