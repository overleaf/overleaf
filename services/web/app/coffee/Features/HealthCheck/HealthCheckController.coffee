Mocha = require "mocha"
Base = require("mocha/lib/reporters/base")
RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("health_check")
settings = require("settings-sharelatex")
logger = require "logger-sharelatex"
domain = require "domain"
UserGetter = require("../User/UserGetter")

module.exports = HealthCheckController =
	check: (req, res, next = (error) ->) ->
		d = domain.create()
		d.on "error", (error) ->
			logger.err err: error, "error in mocha"
		d.run () ->
			mocha = new Mocha(reporter: Reporter(res), timeout: 10000)
			mocha.addFile("test/smoke/js/SmokeTests.js")
			mocha.run () ->
				# TODO: combine this with the smoke-test-sharelatex module
				# we need to clean up all references to the smokeTest module
				# so it can be garbage collected.  The only reference should
				# be in its parent, when it is loaded by mocha.addFile.
				path = require.resolve(__dirname + "/../../../../test/smoke/js/SmokeTests.js")
				smokeTestModule = require.cache[path]
				if smokeTestModule?
					parent = smokeTestModule.parent
					while (idx = parent.children.indexOf(smokeTestModule)) != -1
						parent.children.splice(idx, 1)
				else
					logger.warn {path}, "smokeTestModule not defined"
				# remove the smokeTest from the module cache
				delete require.cache[path]

	checkRedis: (req, res, next)->
		rclient.healthCheck (error) ->
			if error?
				logger.err {err: error}, "failed redis health check"
				res.sendStatus 500
			else
				res.sendStatus 200

	checkMongo: (req, res, next)->
		logger.log "running mongo health check"
		UserGetter.getUserEmail settings.smokeTest.userId, (err, email)->
			if err?
				logger.err err:err, "mongo health check failed, error present"
				return res.sendStatus 500
			else if !email?
				logger.err err:err, "mongo health check failed, no emai present in find result"
				return res.sendStatus 500
			else
				logger.log email:email, "mongo health check passed"
				res.sendStatus 200

		
Reporter = (res) ->
	(runner) ->
		Base.call(this, runner)

		tests = []
		passes = []
		failures = []

		runner.on 'test end', (test) -> tests.push(test)
		runner.on 'pass',     (test) -> passes.push(test)
		runner.on 'fail',     (test) -> failures.push(test)

		runner.on 'end', () =>
			clean = (test) ->
				title: test.fullTitle()
				duration: test.duration
				err: test.err
				timedOut: test.timedOut

			results = {
				stats: @stats
				failures: failures.map(clean)
				passes: passes.map(clean)
			}

			res.contentType("application/json")
			if failures.length > 0
				logger.err failures:failures, "health check failed"
				res.status(500).send(JSON.stringify(results, null, 2))
			else
				res.status(200).send(JSON.stringify(results, null, 2))

