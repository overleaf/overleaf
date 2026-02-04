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
})
