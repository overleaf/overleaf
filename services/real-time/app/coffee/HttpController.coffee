async = require "async"

module.exports = HttpController =
	# The code in this controller is hard to unit test because of a lot of 
	# dependencies on internal socket.io methods. It is not critical to the running
	# of ShareLaTeX, and is only used for getting stats about connected clients,
	# and for checking internal state in acceptance tests. The acceptances tests
	# should provide appropriate coverage.
	_getConnectedClientView: (ioClient, callback = (error, client) ->) ->
			client_id = ioClient.id
			{project_id, user_id, first_name, last_name, email, connected_time} = ioClient.ol_context
			client = {client_id, project_id, user_id, first_name, last_name, email, connected_time}
			client.rooms = []
			for name, joined of ioClient.manager.roomClients[client_id]
				if joined and name != ""
					client.rooms.push name.replace(/^\//, "") # Remove leading /
			callback(null, client)

	getConnectedClients: (req, res, next) ->
		io = req.app.get("io")
		ioClients = io.sockets.clients()
		async.map ioClients, HttpController._getConnectedClientView, (error, clients) ->
			return next(error) if error?
			res.json clients
			
	getConnectedClient: (req, res, next) ->
		{client_id} = req.params
		io = req.app.get("io")
		ioClient = io.sockets.sockets[client_id]
		if !ioClient
			res.sendStatus(404)
			return
		HttpController._getConnectedClientView ioClient, (error, client) ->
			return next(error) if error?
			res.json client
