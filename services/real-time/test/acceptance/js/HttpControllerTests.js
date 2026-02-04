// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'
import {
  fetchJson,
  fetchNothing,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import { expect } from 'chai'
import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'

describe('HttpControllerTests', function () {
  describe('without a user', function () {
    it('should return 404 for the client view', async function () {
      const clientId = 'not-existing'
      try {
        await fetchNothing(`http://127.0.0.1:3026/clients/${clientId}`)
        expect.fail('request should have failed')
      } catch (error) {
        expect(error).to.be.instanceof(RequestFailedError)
        expect(error.response.status).to.equal(404)
      }
    })
  })

  describe('with a user and after joining a project', function () {
    before(function (done) {
      async.series(
        [
          cb => {
            FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
              },
              (error, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                cb(error)
              }
            )
          },

          cb => {
            FixturesManager.setUpDoc(
              this.project_id,
              {},
              (error, { doc_id: docId }) => {
                this.doc_id = docId
                cb(error)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            this.client.emit('joinDoc', this.doc_id, cb)
          },
        ],
        done
      )
    })

    it('should send a client view', async function () {
      const data = await fetchJson(
        `http://127.0.0.1:3026/clients/${this.client.socket.sessionid}`
      )
      expect(data.connected_time).to.exist
      delete data.connected_time
      // .email is not set in the session
      delete data.email
      expect(data).to.deep.equal({
        client_id: this.client.socket.sessionid,
        first_name: 'Joe',
        last_name: 'Bloggs',
        project_id: this.project_id,
        user_id: this.user_id,
        rooms: [this.project_id, this.doc_id],
      })
    })
  })
})
