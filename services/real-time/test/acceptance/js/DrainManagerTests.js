// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const RealTimeClient = require('./helpers/RealTimeClient')
const FixturesManager = require('./helpers/FixturesManager')

const { expect } = require('chai')

const async = require('async')
const request = require('request')

const drain = function (rate, callback) {
  request.post(
    {
      url: `http://localhost:3026/drain?rate=${rate}`,
    },
    (error, response, data) => callback(error, data)
  )
  return null
}

describe('DrainManagerTests', function () {
  before(function (done) {
    FixturesManager.setUpProject(
      {
        privilegeLevel: 'owner',
        project: {
          name: 'Test Project',
        },
      },
      (e, { project_id: projectId, user_id: userId }) => {
        this.project_id = projectId
        this.user_id = userId
        return done()
      }
    )
    return null
  })

  before(function (done) {
    // cleanup to speedup reconnecting
    this.timeout(10000)
    return RealTimeClient.disconnectAllClients(done)
  })

  // trigger and check cleanup
  it('should have disconnected all previous clients', function (done) {
    return RealTimeClient.getConnectedClients((error, data) => {
      if (error) {
        return done(error)
      }
      expect(data.length).to.equal(0)
      return done()
    })
  })

  return describe('with two clients in the project', function () {
    beforeEach(function (done) {
      return async.series(
        [
          cb => {
            this.clientA = RealTimeClient.connect()
            return this.clientA.on('connectionAccepted', cb)
          },

          cb => {
            this.clientB = RealTimeClient.connect()
            return this.clientB.on('connectionAccepted', cb)
          },

          cb => {
            return this.clientA.emit(
              'joinProject',
              { project_id: this.project_id },
              cb
            )
          },

          cb => {
            return this.clientB.emit(
              'joinProject',
              { project_id: this.project_id },
              cb
            )
          },
        ],
        done
      )
    })

    return describe('starting to drain', function () {
      beforeEach(function (done) {
        return async.parallel(
          [
            cb => {
              return this.clientA.on('reconnectGracefully', cb)
            },
            cb => {
              return this.clientB.on('reconnectGracefully', cb)
            },

            cb => drain(2, cb),
          ],
          done
        )
      })

      afterEach(function (done) {
        return drain(0, done)
      }) // reset drain

      it('should not timeout', function () {
        return expect(true).to.equal(true)
      })

      return it('should not have disconnected', function () {
        expect(this.clientA.socket.connected).to.equal(true)
        return expect(this.clientB.socket.connected).to.equal(true)
      })
    })
  })
})
