/* eslint-disable
    n/handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import Settings from '@overleaf/settings'

import request from './helpers/request.js'

describe('siteIsOpen', function () {
  describe('when siteIsOpen is default (true)', function () {
    it('should get page', function (done) {
      return request.get('/login', (error, response, body) => {
        response.statusCode.should.equal(200)
        return done()
      })
    })
  })

  describe('when siteIsOpen is false', function () {
    beforeEach(function () {
      return (Settings.siteIsOpen = false)
    })

    afterEach(function () {
      return (Settings.siteIsOpen = true)
    })

    it('should return maintenance page', function (done) {
      request.get('/login', (error, response, body) => {
        response.statusCode.should.equal(503)
        body.should.match(/is currently down for maintenance/)
        done()
      })
    })

    it('should return a plain text message for a json request', function (done) {
      request.get('/some/route', { json: true }, (error, response, body) => {
        response.statusCode.should.equal(503)
        body.message.should.match(/maintenance/)
        body.message.should.match(/status.example.com/)
        done()
      })
    })

    it('should return a 200 on / for load balancer health checks', function (done) {
      request.get('/', (error, response, body) => {
        response.statusCode.should.equal(200)
        done()
      })
    })

    it('should return a 200 on /status for readiness checks', function (done) {
      request.get('/status', (error, response, body) => {
        response.statusCode.should.equal(200)
        done()
      })
    })
  })
})
