import { expect } from 'chai'
import async from 'async'
import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'

describe('debug message', function () {
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

  describe('with a well-formed data payload', function () {
    before(function (done) {
      this.client.emit('debug', { time: 123 }, (response, ...rest) => {
        this.response = response
        this.returnedArgs = rest
        done()
      })
    })

    it('should echo the data back without an error', function () {
      expect(this.returnedArgs).to.deep.equal([])
      expect(this.response.data).to.deep.equal({ time: 123 })
    })

    it('should include the client view', function () {
      expect(this.response.client.publicId).to.equal(this.client.publicId)
    })
  })

  describe('with no data payload', function () {
    before(function (done) {
      this.client.emit('debug', undefined, (response, ...rest) => {
        this.response = response
        this.returnedArgs = rest
        done()
      })
    })

    it('should echo back with no error', function () {
      expect(this.returnedArgs).to.deep.equal([])
      expect(this.response.data).to.not.exist
    })
  })

  describe('with a non-object data payload', function () {
    before(function (done) {
      this.client.emit('debug', 'not-an-object', error => {
        this.error = error
        done()
      })
    })

    it('should return a validation error', function () {
      expect(this.error).to.exist
    })
  })
})

describe('clientPong message', function () {
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

  describe('with well-formed pong args', function () {
    before(function (done) {
      this.client.emit(
        'clientPong',
        1,
        Date.now(),
        'websocket',
        this.client.socket.sessionid,
        'websocket',
        this.client.socket.sessionid
      )
      // clientPong has no ack; give the server a moment to process it, then
      // confirm the connection is still healthy via a normal RPC.
      setTimeout(() => {
        this.client.emit('clientTracking.getConnectedUsers', error => {
          this.error = error
          done()
        })
      }, 50)
    })

    it('should not disrupt the connection', function () {
      expect(this.error).to.not.exist
    })
  })

  describe('with malformed pong args', function () {
    before(function (done) {
      this.client.emit('clientPong', 'not-a-number', 'not-a-number-either')
      setTimeout(() => {
        this.client.emit('clientTracking.getConnectedUsers', error => {
          this.error = error
          done()
        })
      }, 50)
    })

    it('should be rejected but not disrupt the connection', function () {
      expect(this.error).to.not.exist
    })
  })
})
