// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import RealTimeClient from './helpers/RealTimeClient.js'

import FixturesManager from './helpers/FixturesManager.js'
import { expect } from 'chai'
import async from 'async'
import { fetchNothing } from '@overleaf/fetch-utils'

const drain = async function (rate) {
  await fetchNothing(`http://127.0.0.1:3026/drain?rate=${rate}`, {
    method: 'POST',
  })
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
        done()
      }
    )
    return null
  })

  before(function (done) {
    // cleanup to speedup reconnecting
    this.timeout(10000)
    RealTimeClient.disconnectAllClients(done)
  })

  // trigger and check cleanup
  it('should have disconnected all previous clients', function (done) {
    RealTimeClient.getConnectedClients((error, data) => {
      if (error) {
        return done(error)
      }
      expect(data.length).to.equal(0)
      done()
    })
  })

  describe('with two clients in the project', function () {
    beforeEach(function (done) {
      async.series(
        [
          cb => {
            this.clientA = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            this.clientB = RealTimeClient.connect(this.project_id, cb)
          },
        ],
        done
      )
    })

    describe('starting to drain', function () {
      beforeEach(function (done) {
        async.parallel(
          [
            cb => {
              this.clientA.on('reconnectGracefully', cb)
            },
            cb => {
              this.clientB.on('reconnectGracefully', cb)
            },

            cb =>
              drain(2)
                .then(() => cb())
                .catch(cb),
          ],
          done
        )
      })

      afterEach(async function () {
        await drain(0)
      }) // reset drain

      it('should not timeout', function () {
        expect(true).to.equal(true)
      })

      it('should not have disconnected', function () {
        expect(this.clientA.socket.connected).to.equal(true)
        expect(this.clientB.socket.connected).to.equal(true)
      })
    })
  })

  describe('with three clients in the project', function () {
    beforeEach(function (done) {
      async.series(
        [
          cb => {
            this.clientA = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            this.clientB = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            this.clientC = RealTimeClient.connect(this.project_id, cb)
          },
        ],
        done
      )
    })

    describe('starting to drain with a fractional rate', function () {
      beforeEach(function (done) {
        this.timeout(10000)
        this.reconnectedAt = []
        const trackReconnect = client => cb =>
          client.on('reconnectGracefully', () => {
            this.reconnectedAt.push(Date.now())
            cb()
          })
        async.parallel(
          [
            trackReconnect(this.clientA),
            trackReconnect(this.clientB),
            trackReconnect(this.clientC),

            cb =>
              drain(1.5)
                .then(() => cb())
                .catch(cb),
          ],
          done
        )
      })

      afterEach(async function () {
        // reset drain
        await drain(0)
      })

      it('should spread the reconnects over multiple polling intervals', function () {
        // At a rate of 1.5 clients per second, two clients should be asked to
        // reconnect in the first 1s polling interval and the third client one
        // polling interval later.
        const sorted = this.reconnectedAt.slice().sort((a, b) => a - b)
        expect(sorted[2] - sorted[0]).to.be.greaterThan(500)
      })
    })
  })
})
