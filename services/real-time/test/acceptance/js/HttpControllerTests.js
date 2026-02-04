// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'
import Request from 'request'
import { expect } from 'chai'
import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'

const request = Request.defaults({
  baseUrl: 'http://127.0.0.1:3026',
})

describe('HttpControllerTests', function () {
  describe('without a user', function () {
    it('should return 404 for the client view', function (done) {
      const clientId = 'not-existing'
      request.get(
        {
          url: `/clients/${clientId}`,
          json: true,
        },
        (error, response, data) => {
          if (error) {
            return done(error)
          }
          expect(response.statusCode).to.equal(404)
          done()
        }
      )
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

    it('should send a client view', function (done) {
      request.get(
        {
          url: `/clients/${this.client.socket.sessionid}`,
          json: true,
        },
        (error, response, data) => {
          if (error) {
            return done(error)
          }
          expect(response.statusCode).to.equal(200)
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
          done()
        }
      )
    })
  })
})
