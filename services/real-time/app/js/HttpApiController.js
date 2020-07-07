/* eslint-disable
    camelcase,
*/
const WebsocketLoadBalancer = require('./WebsocketLoadBalancer')
const DrainManager = require('./DrainManager')
const logger = require('logger-sharelatex')

module.exports = {
  sendMessage(req, res) {
    logger.log({ message: req.params.message }, 'sending message')
    if (Array.isArray(req.body)) {
      for (const payload of req.body) {
        WebsocketLoadBalancer.emitToRoom(
          req.params.project_id,
          req.params.message,
          payload
        )
      }
    } else {
      WebsocketLoadBalancer.emitToRoom(
        req.params.project_id,
        req.params.message,
        req.body
      )
    }
    res.send(204)
  },

  startDrain(req, res) {
    const io = req.app.get('io')
    let rate = req.query.rate || '4'
    rate = parseFloat(rate) || 0
    logger.log({ rate }, 'setting client drain rate')
    DrainManager.startDrain(io, rate)
    res.send(204)
  },

  disconnectClient(req, res, next) {
    const io = req.app.get('io')
    const { client_id } = req.params
    const client = io.sockets.sockets[client_id]

    if (!client) {
      logger.info({ client_id }, 'api: client already disconnected')
      res.sendStatus(404)
      return
    }
    logger.warn({ client_id }, 'api: requesting client disconnect')
    client.on('disconnect', () => res.sendStatus(204))
    client.disconnect()
  }
}
