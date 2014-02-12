CompileController = require "./app/js/CompileController"
Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
logger.initialize("clsi")
smokeTest = require "smoke-test-sharelatex"

ProjectPersistenceManager = require "./app/js/ProjectPersistenceManager"

require("./app/js/db").sync()

express = require "express"
app = express()

app.post "/project/:project_id/compile", express.bodyParser(), CompileController.compile
app.del  "/project/:project_id", CompileController.clearCache

staticServer = express.static(Settings.path.compilesDir)
app.get "/project/:project_id/output/*", (req, res, next) ->
	req.url = "/#{req.params.project_id}/#{req.params[0]}"
	staticServer(req, res, next)

app.get "/status", (req, res, next) ->
	res.send "CLSI is alive\n"

app.get "/health_check", smokeTest.run(require.resolve(__dirname + "/test/smoke/js/SmokeTests.js"))

app.use (error, req, res, next) ->
	logger.error err: error, "server error"
	res.send 500

app.listen port = (Settings.internal?.clsi?.port or 3013), host = (Settings.internal?.clsi?.host or "localhost"), (error) ->
	logger.log "CLSI listening on #{host}:#{port}"

setInterval () ->
	ProjectPersistenceManager.clearExpiredProjects()
, tenMinutes = 10 * 60 * 1000
