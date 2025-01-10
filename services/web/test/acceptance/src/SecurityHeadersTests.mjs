/* eslint-disable
    n/handle-callback-err,
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
import { assert } from 'chai'

import async from 'async'
import User from './helpers/User.mjs'
import request from './helpers/request.js'
import ProjectGetter from '../../../app/src/Features/Project/ProjectGetter.js'

const assertHasCommonHeaders = function (response) {
  const { headers } = response
  assert.include(headers, {
    'x-download-options': 'noopen',
    'x-xss-protection': '0',
    'cross-origin-resource-policy': 'same-origin',
    'cross-origin-opener-policy': 'same-origin-allow-popups',
    'x-content-type-options': 'nosniff',
    'x-permitted-cross-domain-policies': 'none',
    'referrer-policy': 'origin-when-cross-origin',
  })
  assert.isUndefined(headers['cross-origin-embedder-policy'])
}

const assertHasCacheHeaders = function (response) {
  assert.include(response.headers, {
    'surrogate-control': 'no-store',
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    pragma: 'no-cache',
    expires: '0',
  })
}

const assertHasNoCacheHeaders = function (response) {
  assert.doesNotHaveAnyKeys(response.headers, [
    'surrogate-control',
    'cache-control',
    'pragma',
    'expires',
  ])
}

const assertHasAssetCachingHeaders = function (response) {
  assert.equal(response.headers['cache-control'], 'public, max-age=31536000')
}

describe('SecurityHeaders', function () {
  beforeEach(function () {
    return (this.user = new User())
  })

  it('should not have x-powered-by header', function (done) {
    return request.get('/', (err, res, body) => {
      assert.isUndefined(res.headers['x-powered-by'])
      return done()
    })
  })

  it('should have all common headers', function (done) {
    return request.get('/', (err, res, body) => {
      assertHasCommonHeaders(res)
      return done()
    })
  })

  it('should not have cache headers on public pages', function (done) {
    return request.get('/', (err, res, body) => {
      assertHasNoCacheHeaders(res)
      return done()
    })
  })

  it('should have caching headers on static assets', function (done) {
    request.get('/favicon.ico', (err, res) => {
      assertHasAssetCachingHeaders(res)
      done(err)
    })
  })

  it('should have cache headers when user is logged in', function (done) {
    return async.series(
      [
        cb => this.user.login(cb),
        cb => this.user.request.get('/', cb),
        cb => this.user.logout(cb),
      ],
      (err, results) => {
        const mainResponse = results[1][0]
        assertHasCacheHeaders(mainResponse)
        return done()
      }
    )
  })

  it('should have cache headers on project page when user is logged out', function (done) {
    return async.series(
      [
        cb => this.user.login(cb),
        cb =>
          this.user.createProject('public-project', (error, projectId) => {
            if (error != null) {
              return done(error)
            }
            this.project_id = projectId
            return this.user.makePublic(this.project_id, 'readAndWrite', cb)
          }),
        cb => this.user.logout(cb),
        cb => request.get(`/project/${this.project_id}`, cb),
      ],
      (err, res) => {
        const mainResponse = res[3][0]
        assertHasCacheHeaders(mainResponse)
        return done()
      }
    )
  })

  it('should have private cache headers on project file', function (done) {
    return async.series(
      [
        cb => this.user.login(cb),
        cb =>
          this.user.createProject(
            'public-project',
            (error, projectId, folderId) => {
              if (error != null) {
                return done(error)
              }
              this.project_id = projectId
              return this.user.makePublic(this.project_id, 'readAndWrite', cb)
            }
          ),
        cb =>
          ProjectGetter.getProject(this.project_id, (error, project) => {
            if (error) {
              return cb(error)
            }
            this.root_folder_id = project.rootFolder[0]._id.toString()
            cb()
          }),
        cb => {
          return this.user.uploadFileInProject(
            this.project_id,
            this.root_folder_id,
            '2pixel.png',
            '1pixel.png',
            'image/png',
            (error, fileId) => {
              if (error) {
                return cb(error)
              }
              this.file_id = fileId
              cb()
            }
          )
        },
        cb =>
          request.get(`/project/${this.project_id}/file/${this.file_id}`, cb),
        cb => this.user.logout(cb),
      ],
      (err, results) => {
        const res = results[4][0]

        assert.include(res.headers, {
          'cache-control': 'private, max-age=3600',
        })

        assert.doesNotHaveAnyKeys(res.headers, [
          'surrogate-control',
          'pragma',
          'expires',
        ])

        return done()
      }
    )
  })

  it('should have caching headers on static assets when user is logged in', function (done) {
    async.series(
      [
        cb => this.user.login(cb),
        cb => this.user.request.get('/favicon.ico', cb),
        cb => this.user.logout(cb),
      ],
      (err, results) => {
        const res = results[1][0]
        assertHasAssetCachingHeaders(res)
        done()
      }
    )
  })
})
