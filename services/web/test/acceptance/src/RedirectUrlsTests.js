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
  request[method](path, function(error, response) {
    should.not.exist(error)
    response.statusCode.should.equal(expectedStatusCode)
    response.headers.location.should.equal(destination)
    return cb()
  })

describe('RedirectUrls', function() {
  before(function() {
    return this.timeout(1000)
  })

  it('proxy static URLs', done =>
    assertRedirect('get', '/redirect/one', 302, '/destination/one', done))

  it('proxy dynamic URLs', done =>
    assertRedirect(
      'get',
      '/redirect/params/42',
      302,
      '/destination/42/params',
      done
    ))

  it('proxy URLs with baseUrl', done =>
    assertRedirect(
      'get',
      '/redirect/base_url',
      302,
      'https://example.com/destination/base_url',
      done
    ))

  it('proxy URLs with POST with a 307', done =>
    assertRedirect(
      'post',
      '/redirect/get_and_post',
      307,
      '/destination/get_and_post',
      done
    ))

  it('proxy URLs with multiple support methods', done =>
    assertRedirect(
      'get',
      '/redirect/get_and_post',
      302,
      '/destination/get_and_post',
      done
    ))

  it('redirects with query params', done =>
    assertRedirect(
      'get',
      '/redirect/qs?foo=bar&baz[]=qux1&baz[]=qux2',
      302,
      '/destination/qs?foo=bar&baz[]=qux1&baz[]=qux2',
      done
    ))

  it("skips redirects if the 'skip-redirects' header is set", done =>
    request.get(
      { url: '/redirect/one', headers: { 'x-skip-redirects': 'true' } },
      function(error, response) {
        should.not.exist(error)
        response.statusCode.should.equal(404)
        return done()
      }
    ))

  return it('redirects to /sign_in_to_v1 with authWithV1 setting', done =>
    assertRedirect(
      'get',
      '/docs_v1?zip_uri=http%3A%2F%2Foverleaf.test%2Ffoo%3Fbar%3Dbaz%26qux%3Dthing&bar=baz',
      302,
      '/sign_in_to_v1?return_to=%2Fdocs%3Fzip_uri%3Dhttp%253A%252F%252Foverleaf.test%252Ffoo%253Fbar%253Dbaz%2526qux%253Dthing%26bar%3Dbaz',
      done
    ))
})
