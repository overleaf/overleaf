// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'

import { expect } from 'chai'
import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'

describe('Router', function () {
  return describe('joinProject', function () {
    describe('when there is no callback provided', function () {
      after(function () {
        return process.removeListener('unhandledRejection', this.onUnhandled)
      })

      before(function (done) {
        this.onUnhandled = error => done(error)
        process.on('unhandledRejection', this.onUnhandled)
        return async.series(
          [
            cb => {
              return FixturesManager.setUpProject(
                {
                  privilegeLevel: 'owner',
                  project: {
                    name: 'Test Project',
                  },
                },
                (e, { project_id: projectId, user_id: userId }) => {
                  this.project_id = projectId
                  this.user_id = userId
                  return cb(e)
                }
              )
            },

            cb => {
              this.client = RealTimeClient.connect(this.project_id, cb)
            },

            cb => {
              return setTimeout(cb, 100)
            },
          ],
          done
        )
      })

      return it('should keep on going', function () {
        return expect('still running').to.exist
      })
    })

    return describe('when there are too many arguments', function () {
      after(function () {
        return process.removeListener('unhandledRejection', this.onUnhandled)
      })

      before(function (done) {
        this.onUnhandled = error => done(error)
        process.on('unhandledRejection', this.onUnhandled)
        return async.series(
          [
            cb => {
              return FixturesManager.setUpProject(
                {
                  privilegeLevel: 'owner',
                  project: {
                    name: 'Test Project',
                  },
                },
                (e, { project_id: projectId, user_id: userId }) => {
                  this.project_id = projectId
                  this.user_id = userId
                  return cb(e)
                }
              )
            },

            cb => {
              this.client = RealTimeClient.connect(this.project_id, cb)
            },

            cb => {
              return this.client.emit('joinDoc', 1, 2, 3, 4, 5, error => {
                this.error = error
                return cb()
              })
            },
          ],
          done
        )
      })

      return it('should return an error message', function () {
        return expect(this.error.message).to.equal('unexpected arguments')
      })
    })
  })
})
