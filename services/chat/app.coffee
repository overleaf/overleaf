logger = require 'logger-sharelatex'

Server = require "./app/js/server"
Server.server.listen(3010, "localhost")
logger.log "chat sharelatex listening on port 3010"