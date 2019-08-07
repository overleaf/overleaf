/* eslint-disable
    max-len,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const child = require('child_process')
let fs = require('fs')
const assert = require('assert')
const chai = require('chai')
if (Object.prototype.should == null) {
  chai.should()
}
const { expect } = chai
const Settings = require('settings-sharelatex')
let ownPort = Settings.internal.web.port || Settings.port || 3000
const port = Settings.web.web_router_port || ownPort // send requests to web router if this is the api process
const cookeFilePath = `/tmp/smoke-test-cookie-${ownPort}-to-${port}.txt`
const buildUrl = path =>
  ` -b ${cookeFilePath} --resolve 'smoke${
    Settings.cookieDomain
  }:${port}:127.0.0.1' http://smoke${
    Settings.cookieDomain
  }:${port}/${path}?setLng=en`
const logger = require('logger-sharelatex')
const LoginRateLimiter = require('../../../app/src/Features/Security/LoginRateLimiter.js')
const RateLimiter = require('../../../app/src/infrastructure/RateLimiter.js')

// Change cookie to be non secure so curl will send it
const convertCookieFile = function(callback) {
  fs = require('fs')
  return fs.readFile(cookeFilePath, 'utf8', (err, data) => {
    if (err) {
      return callback(err)
    }
    const firstTrue = data.indexOf('TRUE')
    const secondTrue = data.indexOf('TRUE', firstTrue + 4)
    const result =
      data.slice(0, secondTrue) + 'FALSE' + data.slice(secondTrue + 4)
    return fs.writeFile(cookeFilePath, result, 'utf8', err => {
      if (err) {
        return callback(err)
      }
      return callback()
    })
  })
}

describe('Opening', function() {
  before(function(done) {
    logger.log('smoke test: setup')
    LoginRateLimiter.recordSuccessfulLogin(Settings.smokeTest.user, err => {
      if (err != null) {
        logger.err({ err }, 'smoke test: error recoring successful login')
        return done(err)
      }
      return RateLimiter.clearRateLimit(
        'open-project',
        `${Settings.smokeTest.projectId}:${Settings.smokeTest.userId}`,
        err => {
          if (err != null) {
            logger.err(
              { err },
              'smoke test: error clearing open-project rate limit'
            )
            return done(err)
          }
          return RateLimiter.clearRateLimit(
            'overleaf-login',
            Settings.smokeTest.rateLimitSubject,
            err => {
              if (err != null) {
                logger.err(
                  { err },
                  'smoke test: error clearing overleaf-login rate limit'
                )
                return done(err)
              }
              return done()
            }
          )
        }
      )
    })
  })

  before(function(done) {
    logger.log('smoke test: hitting dev/csrf')
    let command = `\
curl -H  "X-Forwarded-Proto: https" -c ${cookeFilePath} ${buildUrl('dev/csrf')}\
`
    child.exec(command, (err, stdout, stderr) => {
      if (err != null) {
        done(err)
      }
      const csrf = stdout
      logger.log('smoke test: converting cookie file 1')
      return convertCookieFile(err => {
        if (err != null) {
          return done(err)
        }
        logger.log('smoke test: hitting /login with csrf')
        command = `\
curl -c ${cookeFilePath} -H "Content-Type: application/json" -H "X-Forwarded-Proto: https" -d '{"_csrf":"${csrf}", "email":"${
          Settings.smokeTest.user
        }", "password":"${Settings.smokeTest.password}"}' ${buildUrl('login')}\
`
        return child.exec(command, err => {
          if (err != null) {
            return done(err)
          }
          logger.log('smoke test: finishing setup')
          return convertCookieFile(done)
        })
      })
    })
  })

  after(function(done) {
    logger.log('smoke test: converting cookie file 2')
    convertCookieFile(err => {
      if (err != null) {
        return done(err)
      }
      logger.log('smoke test: cleaning up')
      let command = `\
curl -H  "X-Forwarded-Proto: https" -c ${cookeFilePath} ${buildUrl('dev/csrf')}\
`
      return child.exec(command, (err, stdout, stderr) => {
        if (err != null) {
          done(err)
        }
        const csrf = stdout
        logger.log('smoke test: converting cookie file 3')
        return convertCookieFile(err => {
          if (err != null) {
            return done(err)
          }
          command = `\
curl -H "Content-Type: application/json" -H "X-Forwarded-Proto: https" -d '{"_csrf":"${csrf}"}' -c ${cookeFilePath} ${buildUrl(
            'logout'
          )}\
`
          return child.exec(command, (err, stdout, stderr) => {
            if (err != null) {
              return done(err)
            }
            return fs.unlink(cookeFilePath, done)
          })
        })
      })
    })
  })

  it('a project', function(done) {
    logger.log('smoke test: Checking can load a project')
    this.timeout(4000)
    const command = `\
curl -H "X-Forwarded-Proto: https" -v ${buildUrl(
      `project/${Settings.smokeTest.projectId}`
    )}\
`
    return child.exec(command, (error, stdout, stderr) => {
      expect(error, 'smoke test: error in getting project').to.not.exist

      const statusCodeMatch = !!stderr.match('200 OK')
      expect(
        statusCodeMatch,
        'smoke test: response code is not 200 getting project'
      ).to.equal(true)

      // Check that the project id is present in the javascript that loads up the project
      const match = !!stdout.match(
        `window.project_id = \"${Settings.smokeTest.projectId}\"`
      )
      expect(
        match,
        'smoke test: project page html does not have project_id'
      ).to.equal(true)
      return done()
    })
  })

  it('the project list', function(done) {
    logger.log('smoke test: Checking can load project list')
    this.timeout(4000)
    const command = `\
curl -H "X-Forwarded-Proto: https" -v ${buildUrl('project')}\
`
    return child.exec(command, (error, stdout, stderr) => {
      expect(error, 'smoke test: error returned in getting project list').to.not
        .exist
      expect(
        !!stderr.match('200 OK'),
        'smoke test: response code is not 200 getting project list'
      ).to.equal(true)
      expect(
        !!stdout.match(
          '<title>Your Projects - .*, Online LaTeX Editor</title>'
        ),
        'smoke test: body does not have correct title'
      ).to.equal(true)
      expect(
        !!stdout.match('ProjectPageController'),
        'smoke test: body does not have correct angular controller'
      ).to.equal(true)
      return done()
    })
  })
})
