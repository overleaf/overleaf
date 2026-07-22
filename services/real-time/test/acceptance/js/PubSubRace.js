import RealTimeClient from './helpers/RealTimeClient.js'

import MockDocUpdaterServer from './helpers/MockDocUpdaterServer.js'
import FixturesManager from './helpers/FixturesManager.js'
import async from 'async'
import settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
const rclient = redis.createClient(settings.redis.pubsub)

describe('PubSubRace', function () {
  before(function (done) {
    return MockDocUpdaterServer.run(done)
  })

  return describe('when the client disconnects before joinDoc completes', function () {
    before(function (done) {
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
                return cb()
              }
            )
          },

          cb => {
            this.clientA = RealTimeClient.connect(
              this.project_id,
              (error, project, privilegeLevel, protocolVersion) => {
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                return cb(error)
              }
            )
          },

          cb => {
            return FixturesManager.setUpDoc(
              this.project_id,
              { lines: this.lines, version: this.version, ops: this.ops },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                return cb(e)
              }
            )
          },

          cb => {
            let joinDocCompleted = false
            this.clientA.emit(
              'joinDoc',
              this.doc_id,
              () => (joinDocCompleted = true)
            )
            // leave before joinDoc completes
            return setTimeout(
              () => {
                if (joinDocCompleted) {
                  return cb(new Error('joinDocCompleted -- lower timeout'))
                }
                this.clientA.on('disconnect', () => cb())
                return this.clientA.disconnect()
              },
              // socket.io processes joinDoc and disconnect with different delays:
              //  - joinDoc goes through two process.nextTick
              //  - disconnect goes through one process.nextTick
              // We have to inject the disconnect event into a different event loop
              //  cycle.
              1
            )
          },

          cb => {
            // wait for subscribe and unsubscribe
            return setTimeout(cb, 100)
          },
        ],
        done
      )
    })

    it('should not subscribe to the editor-events channels anymore', function (done) {
      rclient.pubsub('CHANNELS', (err, resp) => {
        if (err) {
          return done(err)
        }
        resp.should.not.include(`editor-events:${this.project_id}`)
        return done()
      })
      return null
    })
  })
})
