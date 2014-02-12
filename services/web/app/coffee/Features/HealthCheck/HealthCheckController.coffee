Mocha = require "mocha"
Base = require("mocha/lib/reporters/base")

module.exports = HealthCheckController =
	check: (req, res, next = (error) ->) ->
		mocha = new Mocha(reporter: Reporter(res), timeout: 10000)
		mocha.addFile("test/smoke/js/SmokeTests.js")
		mocha.run () ->
			path = require.resolve(__dirname + "/../../../../test/smoke/js/SmokeTests.js")
			delete require.cache[path]
		
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

