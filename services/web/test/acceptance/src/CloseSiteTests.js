/* eslint-disable
    handle-callback-err,
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
const Settings = require('settings-sharelatex')
const chai = require('chai')
const request = require('./helpers/request')

describe('siteIsOpen', function() {
  describe('when siteIsOpen is default (true)', () =>
    it('should get page', done =>
      request.get('/login', function(error, response, body) {
        response.statusCode.should.equal(200)
        return done()
      })))

  return describe('when siteIsOpen is false', function() {
    beforeEach(() => (Settings.siteIsOpen = false))

    afterEach(() => (Settings.siteIsOpen = true))

    return it('should return maintenance page', done =>
      request.get('/login', function(error, response) {
        response.statusCode.should.equal(503)
        return done()
      }))
  })
})
