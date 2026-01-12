let HttpController

export default HttpController = {
  // The code in this controller is hard to unit test because of a lot of
  // dependencies on internal socket.io methods. It is not critical to the running
  // of Overleaf, and is only used for getting stats about connected clients,
  // and for checking internal state in acceptance tests. The acceptances tests
  // should provide appropriate coverage.
  _getConnectedClientView(ioClient) {
    const clientId = ioClient.id
    const {
      project_id: projectId,
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
      connected_time: connectedTime,
    } = ioClient.ol_context
    const client = {
      client_id: clientId,
      project_id: projectId,
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
      connected_time: connectedTime,
    }
    client.rooms = Object.keys(ioClient.manager.roomClients[clientId] || {})
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
    const { client_id: clientId } = req.params
    const io = req.app.get('io')
    const ioClient = io.sockets.sockets[clientId]
    if (!ioClient) {
      res.sendStatus(404)
      return
    }
    res.json(HttpController._getConnectedClientView(ioClient))
  },
}
