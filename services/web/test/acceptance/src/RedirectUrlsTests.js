/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const { assert } = require('chai')
const async = require('async')
const request = require('./helpers/request')
const MockV1Api = require('./helpers/MockV1Api')

const assertRedirect = (method, path, expectedStatusCode, destination, cb) =>
  request[method](path, (error, response) => {
    should.not.exist(error)
    response.statusCode.should.equal(expectedStatusCode)
    response.headers.location.should.equal(destination)
    return cb()
  })

describe('RedirectUrls', function() {
  beforeEach(function() {
    return this.timeout(1000)
  })

  it('proxy static URLs', function(done) {
    return assertRedirect('get', '/redirect/one', 302, '/destination/one', done)
  })

  it('proxy dynamic URLs', function(done) {
    return assertRedirect(
      'get',
      '/redirect/params/42',
      302,
      '/destination/42/params',
      done
    )
  })

  it('proxy URLs with baseUrl', function(done) {
    return assertRedirect(
      'get',
      '/redirect/base_url',
      302,
      'https://example.com/destination/base_url',
      done
    )
  })

  it('proxy URLs with POST with a 307', function(done) {
    return assertRedirect(
      'post',
      '/redirect/get_and_post',
      307,
      '/destination/get_and_post',
      done
    )
  })

  it('proxy URLs with multiple support methods', function(done) {
    return assertRedirect(
      'get',
      '/redirect/get_and_post',
      302,
      '/destination/get_and_post',
      done
    )
  })

  it('redirects with query params', function(done) {
    return assertRedirect(
      'get',
      '/redirect/qs?foo=bar&baz[]=qux1&baz[]=qux2',
      302,
      '/destination/qs?foo=bar&baz[]=qux1&baz[]=qux2',
      done
    )
  })

  it("skips redirects if the 'skip-redirects' header is set", function(done) {
    return request.get(
      { url: '/redirect/one', headers: { 'x-skip-redirects': 'true' } },
      (error, response) => {
        should.not.exist(error)
        response.statusCode.should.equal(404)
        return done()
      }
    )
  })
})
