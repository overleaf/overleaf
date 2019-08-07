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

const assertResponse = (path, expectedStatusCode, expectedBody, cb) =>
  request.get(path, (error, response) => {
    should.not.exist(error)
    response.statusCode.should.equal(expectedStatusCode)
    if (expectedBody) {
      assert.deepEqual(JSON.parse(response.body), expectedBody)
    }
    return cb()
  })

describe('ProxyUrls', function() {
  beforeEach(function() {
    return this.timeout(1000)
  })

  it('proxy static URLs', function(done) {
    return async.series(
      [
        cb => assertResponse('/institutions/list', 200, [], cb),
        cb => assertResponse('/institutions/domains', 200, [], cb)
      ],
      done
    )
  })

  it('proxy dynamic URLs', function(done) {
    return async.series(
      [
        cb =>
          assertResponse(
            '/institutions/list/123',
            200,
            { id: 123, name: 'Institution 123' },
            cb
          ),
        cb =>
          assertResponse(
            '/institutions/list/456',
            200,
            { id: 456, name: 'Institution 456' },
            cb
          )
      ],
      done
    )
  })

  it('return 404 if proxy is not set', function(done) {
    return async.series(
      [cb => assertResponse('/institutions/foobar', 404, null, cb)],
      done
    )
  })

  it('handle missing baseUrl', function(done) {
    return async.series(
      [cb => assertResponse('/proxy/missing/baseUrl', 500, null, cb)],
      done
    )
  })
})
