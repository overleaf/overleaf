/* eslint-disable
    camelcase,
*/

let HttpController
module.exports = HttpController = {
  // The code in this controller is hard to unit test because of a lot of
  // dependencies on internal socket.io methods. It is not critical to the running
  // of ShareLaTeX, and is only used for getting stats about connected clients,
  // and for checking internal state in acceptance tests. The acceptances tests
  // should provide appropriate coverage.
  _getConnectedClientView(ioClient) {
    const client_id = ioClient.id
    const {
      project_id,
      user_id,
      first_name,
      last_name,
      email,
      connected_time,
    } = ioClient.ol_context
    const client = {
      client_id,
      project_id,
      user_id,
      first_name,
      last_name,
      email,
      connected_time,
    }
    client.rooms = Object.keys(ioClient.manager.roomClients[client_id] || {})
      // drop the namespace
      .filter(room => room !== '')
      // room names are composed as '<NAMESPACE>/<ROOM>' and the default
      //  namespace is empty (see comments in RoomManager), just drop the '/'
      .map(fullRoomPath => fullRoomPath.slice(1))
    return client
  },

  getConnectedClients(req, res) {
    const io = req.app.get('io')
    const ioClients = io.sockets.clients()

    res.json(ioClients.map(HttpController._getConnectedClientView))
  },

  getConnectedClient(req, res) {
    const { client_id } = req.params
    const io = req.app.get('io')
    const ioClient = io.sockets.sockets[client_id]
    if (!ioClient) {
      res.sendStatus(404)
      return
    }
    res.json(HttpController._getConnectedClientView(ioClient))
  },
}
