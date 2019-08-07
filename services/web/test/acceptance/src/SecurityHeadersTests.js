/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')

const assert_has_common_headers = function(response) {
  const { headers } = response
  assert.equal(headers['x-download-options'], 'noopen')
  assert.equal(headers['x-xss-protection'], '1; mode=block')
  return assert.equal(headers['referrer-policy'], 'origin-when-cross-origin')
}

const assert_has_cache_headers = function(response) {
  const { headers } = response
  assert.equal(headers['surrogate-control'], 'no-store')
  assert.equal(
    headers['cache-control'],
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  )
  assert.equal(headers['pragma'], 'no-cache')
  return assert.equal(headers['expires'], '0')
}

const assert_has_no_cache_headers = function(response) {
  const { headers } = response
  assert.isUndefined(headers['surrogate-control'])
  assert.isUndefined(headers['cache-control'])
  assert.isUndefined(headers['pragma'])
  return assert.isUndefined(headers['expires'])
}

describe('SecurityHeaders', function() {
  beforeEach(function() {
    return (this.user = new User())
  })

  it('should not have x-powered-by header', function(done) {
    return request.get('/', (err, res, body) => {
      assert.isUndefined(res.headers['x-powered-by'])
      return done()
    })
  })

  it('should have all common headers', function(done) {
    return request.get('/', (err, res, body) => {
      assert_has_common_headers(res)
      return done()
    })
  })

  it('should not have cache headers on public pages', function(done) {
    return request.get('/', (err, res, body) => {
      assert_has_no_cache_headers(res)
      return done()
    })
  })

  it('should have cache headers when user is logged in', function(done) {
    return async.series(
      [
        cb => this.user.login(cb),
        cb => this.user.request.get('/', cb),
        cb => this.user.logout(cb)
      ],
      (err, results) => {
        const main_response = results[1][0]
        assert_has_cache_headers(main_response)
        return done()
      }
    )
  })

  it('should have cache headers on project page', function(done) {
    return async.series(
      [
        cb => this.user.login(cb),
        cb => {
          return this.user.createProject(
            'public-project',
            (error, project_id) => {
              if (error != null) {
                return done(error)
              }
              this.project_id = project_id
              return this.user.makePublic(this.project_id, 'readAndWrite', cb)
            }
          )
        },
        cb => this.user.logout(cb)
      ],
      (err, results) => {
        return request.get(`/project/${this.project_id}`, (err, res, body) => {
          assert_has_cache_headers(res)
          return done()
        })
      }
    )
  })
})
