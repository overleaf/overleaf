/* eslint-disable
    handle-callback-err,
    max-len,
    no-path-concat,
    no-unused-vars,
    node/no-deprecated-api,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HealthCheckController
const Mocha = require('mocha')
const Base = require('mocha/lib/reporters/base')
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('health_check')
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const domain = require('domain')
const UserGetter = require('../User/UserGetter')

module.exports = HealthCheckController = {
  check(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const d = domain.create()
    d.on('error', error => logger.err({ err: error }, 'error in mocha'))
    return d.run(function() {
      const mocha = new Mocha({ reporter: Reporter(res), timeout: 10000 })
      mocha.addFile('test/smoke/src/SmokeTests.js')
      return mocha.run(function() {
        // TODO: combine this with the smoke-test-sharelatex module
        // we need to clean up all references to the smokeTest module
        // so it can be garbage collected.  The only reference should
        // be in its parent, when it is loaded by mocha.addFile.
        const path = require.resolve(
          __dirname + '/../../../../test/smoke/src/SmokeTests.js'
        )
        const smokeTestModule = require.cache[path]
        if (smokeTestModule != null) {
          let idx
          const { parent } = smokeTestModule
          while ((idx = parent.children.indexOf(smokeTestModule)) !== -1) {
            parent.children.splice(idx, 1)
          }
        } else {
          logger.warn({ path }, 'smokeTestModule not defined')
        }
        // remove the smokeTest from the module cache
        return delete require.cache[path]
      })
    })
  },

  checkRedis(req, res, next) {
    return rclient.healthCheck(function(error) {
      if (error != null) {
        logger.err({ err: error }, 'failed redis health check')
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },

  checkMongo(req, res, next) {
    logger.log('running mongo health check')
    return UserGetter.getUserEmail(settings.smokeTest.userId, function(
      err,
      email
    ) {
      if (err != null) {
        logger.err({ err }, 'mongo health check failed, error present')
        return res.sendStatus(500)
      } else if (email == null) {
        logger.err(
          { err },
          'mongo health check failed, no emai present in find result'
        )
        return res.sendStatus(500)
      } else {
        logger.log({ email }, 'mongo health check passed')
        return res.sendStatus(200)
      }
    })
  }
}

var Reporter = res =>
  function(runner) {
    Base.call(this, runner)

    const tests = []
    const passes = []
    const failures = []

    runner.on('test end', test => tests.push(test))
    runner.on('pass', test => passes.push(test))
    runner.on('fail', test => failures.push(test))

    return runner.on('end', () => {
      const clean = test => ({
        title: test.fullTitle(),
        duration: test.duration,
        err: test.err,
        timedOut: test.timedOut
      })

      const results = {
        stats: this.stats,
        failures: failures.map(clean),
        passes: passes.map(clean)
      }

      res.contentType('application/json')
      if (failures.length > 0) {
        logger.err({ failures }, 'health check failed')
        return res.status(500).send(JSON.stringify(results, null, 2))
      } else {
        return res.status(200).send(JSON.stringify(results, null, 2))
      }
    })
  }
