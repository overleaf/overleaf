/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect } from 'chai'

import async from 'async'
import User from './helpers/User.mjs'
import request from './helpers/request.js'
import settings from '@overleaf/settings'

const joinProject = (userId, projectId, callback) =>
  request.post(
    {
      url: `/project/${projectId}/join`,
      auth: {
        user: settings.apis.web.user,
        pass: settings.apis.web.pass,
        sendImmediately: true,
      },
      json: { userId },
      jar: false,
    },
    callback
  )

describe('ProjectFeatures', function () {
  beforeEach(function (done) {
    this.timeout(90000)
    this.owner = new User()
    return async.series([cb => this.owner.login(cb)], done)
  })

  describe('with private project', function () {
    beforeEach(function (done) {
      return this.owner.createProject('private-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.project_id = projectId
        return done()
      })
    })

    describe('with an upgraded account', function () {
      beforeEach(function (done) {
        return this.owner.upgradeSomeFeatures(done)
      })
      after(function (done) {
        return this.owner.defaultFeatures(done)
      })

      it('should have premium features', function (done) {
        return joinProject(
          this.owner._id,
          this.project_id,
          (error, response, body) => {
            expect(body.project.features.compileGroup).to.equal('priority')
            expect(body.project.features.versioning).to.equal(true)
            expect(body.project.features.dropbox).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('with an basic account', function () {
      beforeEach(function (done) {
        return this.owner.downgradeFeatures(done)
      })
      after(function (done) {
        return this.owner.defaultFeatures(done)
      })

      it('should have basic features', function (done) {
        return joinProject(
          this.owner._id,
          this.project_id,
          (error, response, body) => {
            expect(body.project.features.compileGroup).to.equal('standard')
            expect(body.project.features.versioning).to.equal(false)
            expect(body.project.features.dropbox).to.equal(false)
            return done()
          }
        )
      })
    })
  })
})
