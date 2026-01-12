/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect } from 'chai'

import FixturesManager from './helpers/FixturesManager.js'
import RealTimeClient from './helpers/RealTimeClient.js'

describe('Session', function () {
  return describe('with an established session', function () {
    before(function (done) {
      FixturesManager.setUpProject(
        { privilegeLevel: 'owner' },
        (error, options) => {
          if (error) return done(error)
          this.client = RealTimeClient.connect(options.project_id, done)
        }
      )
      return null
    })

    it('should not get disconnected', function (done) {
      let disconnected = false
      this.client.on('disconnect', () => (disconnected = true))
      return setTimeout(() => {
        expect(disconnected).to.equal(false)
        return done()
      }, 500)
    })

    return it('should appear in the list of connected clients', function (done) {
      return RealTimeClient.getConnectedClients((error, clients) => {
        if (error) return done(error)
        let included = false
        for (const client of Array.from(clients)) {
          if (client.client_id === this.client.socket.sessionid) {
            included = true
            break
          }
        }
        expect(included).to.equal(true)
        return done()
      })
    })
  })
})
