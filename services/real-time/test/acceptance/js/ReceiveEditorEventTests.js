/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')

const RealTimeClient = require('./helpers/RealTimeClient')
const FixturesManager = require('./helpers/FixturesManager')

const async = require('async')

const settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(settings.redis.pubsub)

describe('receiveEditorEvent', function () {
  beforeEach(function (done) {
    this.lines = ['test', 'doc', 'lines']
    this.version = 42
    this.ops = ['mock', 'doc', 'ops']

    /**
     * We will set up a project, a doc, and three users: the owner, user 'a' and user 'b'
     */
    this.project_id = null
    this.doc_id = null

    this.owner_user_id = null
    this.owner_client = null

    this.user_a_id = null
    this.user_a_client = null

    this.user_b_id = null
    this.user_b_client = null

    async.series(
      [
        /**
         * Create the project, doc, and owner
         */
        cb => {
          return FixturesManager.setUpProject(
            {
              privilegeLevel: 'owner',
              project: { name: 'Test Project' },
            },
            (error, { user_id: userId, project_id: projectId }) => {
              if (error) return done(error)
              this.owner_user_id = userId
              this.project_id = projectId
              return cb()
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

        /**
         * Connect owner to project/doc
         */
        cb => {
          this.owner_client = RealTimeClient.connect()
          return this.owner_client.on('connectionAccepted', cb)
        },

        cb => {
          return this.owner_client.emit(
            'joinProject',
            {
              project_id: this.project_id,
            },
            cb
          )
        },

        cb => {
          return this.owner_client.emit('joinDoc', this.doc_id, cb)
        },

        /**
         * add user_a to project
         */
        cb => {
          return FixturesManager.setUpProject(
            {
              privilegeLevel: 'readAndWrite',
              project_id: this.project_id,
            },
            (error, { user_id: userIdSecond }) => {
              if (error) return done(error)
              this.user_a_id = userIdSecond
              return cb()
            }
          )
        },

        /**
         * Connect user_a to project/doc
         */
        cb => {
          this.user_a_client = RealTimeClient.connect()
          return this.user_a_client.on('connectionAccepted', cb)
        },

        cb => {
          return this.user_a_client.emit(
            'joinProject',
            {
              project_id: this.project_id,
            },
            cb
          )
        },
        cb => {
          return this.user_a_client.emit('joinDoc', this.doc_id, cb)
        },

        /**
         * Set up user_b
         */
        cb => {
          return FixturesManager.setUpProject(
            {
              privilegeLevel: 'readAndWrite',
              project_id: this.project_id,
            },
            (error, { user_id: userIdThird }) => {
              if (error) return done(error)
              this.user_b_id = userIdThird
              return cb()
            }
          )
        },

        /**
         * Connect user_b to project/doc
         */
        cb => {
          this.user_b_client = RealTimeClient.connect()
          return this.user_b_client.on('connectionAccepted', cb)
        },

        cb => {
          return this.user_b_client.emit(
            'joinProject',
            {
              project_id: this.project_id,
            },
            cb
          )
        },
        cb => {
          return this.user_b_client.emit('joinDoc', this.doc_id, cb)
        },

        /**
         * Listen for updates
         */
        cb => {
          const eventName = 'userRemovedFromProject'
          this.owner_updates = []
          this.owner_client.on(eventName, update =>
            this.owner_updates.push({ [eventName]: update })
          )
          this.user_a_updates = []
          this.user_a_client.on(eventName, update =>
            this.user_a_updates.push({ [eventName]: update })
          )
          this.user_b_updates = []
          this.user_b_client.on(eventName, update =>
            this.user_b_updates.push({ [eventName]: update })
          )
          return cb()
        },
      ],
      done
    )
  })

  afterEach(function () {
    if (this.owner_client) {
      this.owner_client.disconnect()
    }
    if (this.user_a_client) {
      this.user_a_client.disconnect()
    }
    if (this.user_b_client) {
      this.user_b_client.disconnect()
    }
  })

  describe('event: userRemovedFromProject', function () {
    let removedUserId
    beforeEach(function (done) {
      /**
       * We remove user_a from the project
       */
      removedUserId = `${this.user_a_id}`
      rclient.publish(
        'editor-events',
        JSON.stringify({
          room_id: this.project_id,
          message: 'userRemovedFromProject',
          payload: [removedUserId],
        })
      )
      setTimeout(done, 200)
    })

    it('should disconnect the removed user', function () {
      expect(this.user_a_client.socket.connected).to.equal(false)
    })

    it('should not disconnect the other users', function () {
      expect(this.owner_client.socket.connected).to.equal(true)
      expect(this.user_b_client.socket.connected).to.equal(true)
    })

    it('should send the event to the remaining connected clients', function () {
      expect(this.owner_updates).to.deep.equal([
        { userRemovedFromProject: removedUserId },
      ])

      expect(this.user_a_updates.length).to.equal(0)

      expect(this.user_b_updates).to.deep.equal([
        { userRemovedFromProject: removedUserId },
      ])
    })
  })
})
