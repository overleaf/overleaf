Mocha = require "mocha"
Base = require("mocha/lib/reporters/base")
redis = require("redis-sharelatex")
settings = require("settings-sharelatex")
redisCheck = redis.activeHealthCheckRedis(settings.redis.web)
logger = require "logger-sharelatex"
domain = require "domain"

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
				parent = smokeTestModule.parent
				while (idx = parent.children.indexOf(smokeTestModule)) != -1
					parent.children.splice(idx, 1)
				# remove the smokeTest from the module cache
				delete require.cache[path]

	checkRedis: (req, res, next)->
		if redisCheck.isAlive()
			res.send 200
		else
			res.send 500
		
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
				res.send 500, JSON.stringify(results, null, 2)
			else
				res.send 200, JSON.stringify(results, null, 2)

