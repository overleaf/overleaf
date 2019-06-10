Metrics = require "metrics-sharelatex"
Metrics.initialize("clsi")

CompileController = require "./app/js/CompileController"
Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
logger.initialize("clsi")
if Settings.sentry?.dsn?
	logger.initializeErrorReporting(Settings.sentry.dsn)

smokeTest = require "smoke-test-sharelatex"
ContentTypeMapper = require "./app/js/ContentTypeMapper"
Errors = require './app/js/Errors'

Path = require "path"
fs = require "fs"


Metrics.open_sockets.monitor(logger)
Metrics.memory.monitor(logger)

ProjectPersistenceManager = require "./app/js/ProjectPersistenceManager"
OutputCacheManager = require "./app/js/OutputCacheManager"

require("./app/js/db").sync()

express = require "express"
bodyParser = require "body-parser"
app = express()

Metrics.injectMetricsRoute(app)
app.use Metrics.http.monitor(logger)

# Compile requests can take longer than the default two
# minutes (including file download time), so bump up the 
# timeout a bit.
TIMEOUT = 10 * 60 * 1000
app.use (req, res, next) ->
	req.setTimeout TIMEOUT
	res.setTimeout TIMEOUT
	res.removeHeader("X-Powered-By")
	next()

app.param 'project_id', (req, res, next, project_id) ->
	if project_id?.match /^[a-zA-Z0-9_-]+$/
		next()
	else
		next new Error("invalid project id")

app.param 'user_id', (req, res, next, user_id) ->
	if user_id?.match /^[0-9a-f]{24}$/
		next()
	else
		next new Error("invalid user id")

app.param 'build_id', (req, res, next, build_id) ->
	if build_id?.match OutputCacheManager.BUILD_REGEX
		next()
	else
		next new Error("invalid build id #{build_id}")


app.post   "/project/:project_id/compile", bodyParser.json(limit: Settings.compileSizeLimit), CompileController.compile
app.post   "/project/:project_id/compile/stop", CompileController.stopCompile
app.delete "/project/:project_id", CompileController.clearCache

app.get  "/project/:project_id/sync/code", CompileController.syncFromCode
app.get  "/project/:project_id/sync/pdf", CompileController.syncFromPdf
app.get  "/project/:project_id/wordcount", CompileController.wordcount
app.get  "/project/:project_id/status", CompileController.status

# Per-user containers
app.post   "/project/:project_id/user/:user_id/compile", bodyParser.json(limit: Settings.compileSizeLimit), CompileController.compile
app.post   "/project/:project_id/user/:user_id/compile/stop", CompileController.stopCompile
app.delete "/project/:project_id/user/:user_id", CompileController.clearCache

app.get  "/project/:project_id/user/:user_id/sync/code", CompileController.syncFromCode
app.get  "/project/:project_id/user/:user_id/sync/pdf", CompileController.syncFromPdf
app.get  "/project/:project_id/user/:user_id/wordcount", CompileController.wordcount

ForbidSymlinks = require "./app/js/StaticServerForbidSymlinks"

# create a static server which does not allow access to any symlinks
# avoids possible mismatch of root directory between middleware check
# and serving the files
staticServer = ForbidSymlinks express.static, Settings.path.compilesDir, setHeaders: (res, path, stat) ->
	if Path.basename(path) == "output.pdf"
		# Calculate an etag in the same way as nginx
		# https://github.com/tj/send/issues/65
		etag = (path, stat) ->
			'"' + Math.ceil(+stat.mtime / 1000).toString(16) +
			'-' + Number(stat.size).toString(16) + '"'
		res.set("Etag", etag(path, stat))
	res.set("Content-Type", ContentTypeMapper.map(path))

app.get "/project/:project_id/user/:user_id/build/:build_id/output/*", (req, res, next) ->
	# for specific build get the path from the OutputCacheManager (e.g. .clsi/buildId)
	req.url = "/#{req.params.project_id}-#{req.params.user_id}/" + OutputCacheManager.path(req.params.build_id, "/#{req.params[0]}")
	staticServer(req, res, next)

app.get "/project/:project_id/build/:build_id/output/*", (req, res, next) ->
	# for specific build get the path from the OutputCacheManager (e.g. .clsi/buildId)
	req.url = "/#{req.params.project_id}/" + OutputCacheManager.path(req.params.build_id, "/#{req.params[0]}")
	staticServer(req, res, next)

app.get "/project/:project_id/user/:user_id/output/*", (req, res, next) ->
	# for specific user get the path to the top level file
	req.url = "/#{req.params.project_id}-#{req.params.user_id}/#{req.params[0]}"
	staticServer(req, res, next)

app.get "/project/:project_id/output/*", (req, res, next) ->
	if req.query?.build? && req.query.build.match(OutputCacheManager.BUILD_REGEX)
		# for specific build get the path from the OutputCacheManager (e.g. .clsi/buildId)
		req.url = "/#{req.params.project_id}/" + OutputCacheManager.path(req.query.build, "/#{req.params[0]}")
	else
		req.url = "/#{req.params.project_id}/#{req.params[0]}"
	staticServer(req, res, next)

app.get "/oops", (req, res, next) ->
	logger.error {err: "hello"}, "test error"
	res.send "error\n"


app.get "/status", (req, res, next) ->
	res.send "CLSI is alive\n"

resCacher =
	contentType:(@setContentType)->
	send:(@code, @body)->

	#default the server to be down
	code:500
	body:{}
	setContentType:"application/json"

if Settings.smokeTest
	do runSmokeTest = ->
		logger.log("running smoke tests")
		smokeTest.run(require.resolve(__dirname + "/test/smoke/js/SmokeTests.js"))({}, resCacher)
		setTimeout(runSmokeTest, 30 * 1000)

app.get "/health_check", (req, res)->
	res.contentType(resCacher?.setContentType)
	res.status(resCacher?.code).send(resCacher?.body)

app.get "/smoke_test_force", (req, res)->
	smokeTest.run(require.resolve(__dirname + "/test/smoke/js/SmokeTests.js"))(req, res)

profiler = require "v8-profiler-node8"
app.get "/profile", (req, res) ->
	time = parseInt(req.query.time || "1000")
	profiler.startProfiling("test")
	setTimeout () ->
		profile = profiler.stopProfiling("test")
		res.json(profile)
	, time

app.get "/heapdump", (req, res)->
	require('heapdump').writeSnapshot '/tmp/' + Date.now() + '.clsi.heapsnapshot', (err, filename)->
		res.send filename

app.use (error, req, res, next) ->
	if error instanceof Errors.NotFoundError
		logger.warn {err: error, url: req.url}, "not found error"
		return res.sendStatus(404)
	else
		logger.error {err: error, url: req.url}, "server error"
		res.sendStatus(error?.statusCode || 500)

net = require "net"
os = require "os"

STATE = "up"


loadTcpServer = net.createServer (socket) ->
	socket.on "error", (err)->
		if err.code == "ECONNRESET"
			# this always comes up, we don't know why
			return
		logger.err err:err, "error with socket on load check"
		socket.destroy()
	
	if STATE == "up" and Settings.internal.load_balancer_agent.report_load
		currentLoad = os.loadavg()[0]

		# staging clis's have 1 cpu core only
		if os.cpus().length == 1
			availableWorkingCpus = 1
		else
			availableWorkingCpus = os.cpus().length - 1

		freeLoad = availableWorkingCpus - currentLoad
		freeLoadPercentage = Math.round((freeLoad / availableWorkingCpus) * 100)
		if freeLoadPercentage <= 0
			freeLoadPercentage = 1 # when its 0 the server is set to drain and will move projects to different servers
		socket.write("up, #{freeLoadPercentage}%\n", "ASCII")
		socket.end()
	else
		socket.write("#{STATE}\n", "ASCII")
		socket.end()

loadHttpServer = express()

loadHttpServer.post "/state/up", (req, res, next) ->
	STATE = "up"
	logger.info "getting message to set server to down"
	res.sendStatus 204

loadHttpServer.post "/state/down", (req, res, next) ->
	STATE = "down"
	logger.info "getting message to set server to down"
	res.sendStatus 204

loadHttpServer.post "/state/maint", (req, res, next) ->
	STATE = "maint"
	logger.info "getting message to set server to maint"
	res.sendStatus 204
	

port = (Settings.internal?.clsi?.port or 3013)
host = (Settings.internal?.clsi?.host or "localhost")

load_tcp_port = Settings.internal.load_balancer_agent.load_port
load_http_port = Settings.internal.load_balancer_agent.local_port

if !module.parent # Called directly
	app.listen port, host, (error) ->
		logger.info "CLSI starting up, listening on #{host}:#{port}"

	loadTcpServer.listen load_tcp_port, host, (error) ->
		throw error if error?
		logger.info "Load tcp agent listening on load port #{load_tcp_port}"

	loadHttpServer.listen load_http_port, host, (error) ->
		throw error if error?
		logger.info "Load http agent listening on load port #{load_http_port}"

module.exports = app

setInterval () ->
	ProjectPersistenceManager.clearExpiredProjects()
, tenMinutes = 10 * 60 * 1000

