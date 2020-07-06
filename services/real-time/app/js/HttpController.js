/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HttpController
const async = require('async')

module.exports = HttpController = {
  // The code in this controller is hard to unit test because of a lot of
  // dependencies on internal socket.io methods. It is not critical to the running
  // of ShareLaTeX, and is only used for getting stats about connected clients,
  // and for checking internal state in acceptance tests. The acceptances tests
  // should provide appropriate coverage.
  _getConnectedClientView(ioClient, callback) {
    if (callback == null) {
      callback = function (error, client) {}
    }
    const client_id = ioClient.id
    const {
      project_id,
      user_id,
      first_name,
      last_name,
      email,
      connected_time
    } = ioClient.ol_context
    const client = {
      client_id,
      project_id,
      user_id,
      first_name,
      last_name,
      email,
      connected_time
    }
    client.rooms = []
    for (const name in ioClient.manager.roomClients[client_id]) {
      const joined = ioClient.manager.roomClients[client_id][name]
      if (joined && name !== '') {
        client.rooms.push(name.replace(/^\//, '')) // Remove leading /
      }
    }
    return callback(null, client)
  },

  getConnectedClients(req, res, next) {
    const io = req.app.get('io')
    const ioClients = io.sockets.clients()
    return async.map(
      ioClients,
      HttpController._getConnectedClientView,
      function (error, clients) {
        if (error != null) {
          return next(error)
        }
        return res.json(clients)
      }
    )
  },

  getConnectedClient(req, res, next) {
    const { client_id } = req.params
    const io = req.app.get('io')
    const ioClient = io.sockets.sockets[client_id]
    if (!ioClient) {
      res.sendStatus(404)
      return
    }
    return HttpController._getConnectedClientView(ioClient, function (
      error,
      client
    ) {
      if (error != null) {
        return next(error)
      }
      return res.json(client)
    })
  }
}
