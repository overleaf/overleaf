import { expect } from 'chai'
import async from 'async'
import {
  fetchNothing,
  fetchString,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'

describe('sendMessage', function () {
  before(function (done) {
    async.series(
      [
        cb => {
          FixturesManager.setUpProject(
            { privilegeLevel: 'owner' },
            (error, { project_id: projectId }) => {
              this.project_id = projectId
              cb(error)
            }
          )
        },
        cb => {
          this.client = RealTimeClient.connect(this.project_id, cb)
        },
      ],
      done
    )
  })

  describe('with a well-formed object payload', function () {
    before(function (done) {
      this.client.once('custom:test:event', payload => {
        this.received = payload
        done()
      })
      fetchNothing(
        `http://127.0.0.1:3026/project/${this.project_id}/message/custom:test:event`,
        {
          method: 'POST',
          json: { foo: 'bar' },
        }
      ).catch(done)
    })

    it('should relay the message to connected clients in the room', function () {
      expect(this.received).to.deep.equal({ foo: 'bar' })
    })
  })

  describe('with a malformed project id', function () {
    it('should return 404', async function () {
      try {
        await fetchNothing(
          'http://127.0.0.1:3026/project/not-a-valid-id/message/custom:test:event',
          {
            method: 'POST',
            json: { foo: 'bar' },
          }
        )
        expect.fail('should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(RequestFailedError)
        expect(error.response.status).to.equal(404)
      }
    })
  })
})

describe('disconnectClient', function () {
  before(function (done) {
    async.series(
      [
        cb => {
          FixturesManager.setUpProject(
            { privilegeLevel: 'owner' },
            (error, { project_id: projectId }) => {
              this.project_id = projectId
              cb(error)
            }
          )
        },
        cb => {
          this.client = RealTimeClient.connect(this.project_id, cb)
        },
      ],
      done
    )
  })

  describe('with a malformed client id', function () {
    it('should return a schema-validation 404, leaving the real client connected', async function () {
      try {
        await fetchNothing(
          'http://127.0.0.1:3026/client/__proto__/disconnect',
          {
            method: 'POST',
          }
        )
        expect.fail('should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(RequestFailedError)
        expect(error.response.status).to.equal(404)
        // The domain-level 404 for an already-disconnected client has no
        // JSON body -- a JSON body with statusCode/error here proves this
        // request was rejected by the client_id schema (InvalidParamsError
        // via handleValidationError), not by the "already disconnected"
        // check in HttpApiController.disconnectClient.
        const body = JSON.parse(error.body)
        expect(body).to.have.property('statusCode', 404)
        expect(body.error).to.be.a('string')
      }
      expect(this.client.socket.connected).to.equal(true)
    })
  })

  describe('with a real client id', function () {
    it('should disconnect the client', function (done) {
      this.client.on('disconnect', () => done())
      fetchNothing(
        `http://127.0.0.1:3026/client/${this.client.socket.sessionid}/disconnect`,
        { method: 'POST' }
      ).catch(done)
    })
  })
})

describe('GET /debug/events', function () {
  it('should accept a numeric count', async function () {
    const body = await fetchString('http://127.0.0.1:3026/debug/events?count=5')
    expect(body).to.equal('debug mode will log next 5 events')
  })

  it('should reject a non-numeric count', async function () {
    try {
      await fetchNothing('http://127.0.0.1:3026/debug/events?count=abc')
      expect.fail('should have thrown')
    } catch (error) {
      expect(error).to.be.instanceOf(RequestFailedError)
      expect(error.response.status).to.equal(400)
    }
  })
})
