logger = require 'logger-sharelatex'
settings = require 'settings-sharelatex'

Server = require "./app/js/server"

port = settings.internal?.chat?.port or 3010
host = settings.internal?.chat?.host or "localhost"

Server.server.listen port, host, (error) ->
	throw error if error?
	logger.log "chat-sharelatex listening on #{host}:#{port}"