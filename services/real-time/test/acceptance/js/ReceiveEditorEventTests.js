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
import { expect } from 'chai'

import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'
import async from 'async'
import settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
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

    this.user_c_id = null
    this.user_c_client = null

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
              userMetadata: { isInvitedMember: true },
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
          this.owner_client = RealTimeClient.connect(this.project_id, cb)
        },

        cb => {
          return this.owner_client.emit('joinDoc', this.doc_id, cb)
        },

        /**
         * add user_a to project, as an invited member
         */
        cb => {
          return FixturesManager.setUpProject(
            {
              privilegeLevel: 'readAndWrite',
              project_id: this.project_id,
              userMetadata: { isTokenMember: false, isInvitedMember: true },
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
          this.user_a_client = RealTimeClient.connect(this.project_id, cb)
        },
        cb => {
          return this.user_a_client.emit('joinDoc', this.doc_id, cb)
        },

        /**
         * Set up user_b, as a token-access/link-sharing user
         */
        cb => {
          return FixturesManager.setUpProject(
            {
              privilegeLevel: 'readAndWrite',
              project_id: this.project_id,
              userMetadata: { isTokenMember: true, isInvitedMember: false },
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
          this.user_b_client = RealTimeClient.connect(this.project_id, cb)
        },
        cb => {
          return this.user_b_client.emit('joinDoc', this.doc_id, cb)
        },

        /**
         * Set up user_c, as a 'restricted' user (anonymous read-only link-sharing)
         */
        cb => {
          return FixturesManager.setUpProject(
            {
              privilegeLevel: 'readAndWrite',
              project_id: this.project_id,
              userMetadata: {
                isTokenMember: false,
                isInvitedMember: false,
                isRestrictedUser: true,
              },
            },
            (error, { user_id: userIdFourth }) => {
              if (error) return done(error)
              this.user_c_id = userIdFourth
              return cb()
            }
          )
        },

        /**
         * Connect user_c to project/doc
         */
        cb => {
          this.user_c_client = RealTimeClient.connect(this.project_id, cb)
        },
        cb => {
          return this.user_c_client.emit('joinDoc', this.doc_id, cb)
        },

        // --------------

        /**
         * Listen for updates
         */
        cb => {
          this.owner_updates = []
          this.user_a_updates = []
          this.user_b_updates = []
          this.user_c_updates = []

          const eventNames = [
            'userRemovedFromProject',
            'project:publicAccessLevel:changed',
            'project:access:revoked',
          ]

          for (const eventName of eventNames) {
            this.owner_client.on(eventName, update =>
              this.owner_updates.push({ [eventName]: update })
            )
            this.user_a_client.on(eventName, update =>
              this.user_a_updates.push({ [eventName]: update })
            )
            this.user_b_client.on(eventName, update =>
              this.user_b_updates.push({ [eventName]: update })
            )
            this.user_c_client.on(eventName, update =>
              this.user_c_updates.push({ [eventName]: update })
            )
          }

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
    if (this.user_c_client) {
      this.user_c_client.disconnect()
    }
  })

  describe('event: project:publicAccessLevel:changed, set to private', function () {
    beforeEach(function (done) {
      /**
       * We turn off link sharing
       */
      rclient.publish(
        'editor-events',
        JSON.stringify({
          room_id: this.project_id,
          message: 'project:publicAccessLevel:changed',
          payload: [{ newAccessLevel: 'private' }],
        })
      )
      setTimeout(done, 200)
    })

    it('should disconnect the token-access user, and restricted users', function () {
      expect(this.user_b_client.socket.connected).to.equal(false)
      expect(this.user_c_client.socket.connected).to.equal(false)
    })

    it('should not disconnect the other users', function () {
      expect(this.owner_client.socket.connected).to.equal(true)
      expect(this.user_a_client.socket.connected).to.equal(true)
    })

    it('should send the event to the remaining connected clients', function () {
      expect(this.owner_updates).to.deep.equal([
        { 'project:publicAccessLevel:changed': { newAccessLevel: 'private' } },
      ])

      expect(this.user_a_updates).to.deep.equal([
        { 'project:publicAccessLevel:changed': { newAccessLevel: 'private' } },
      ])
    })

    it('should send a project:access:revoked message to the disconnected clients', function () {
      expect(this.user_b_updates).to.deep.equal([
        { 'project:access:revoked': undefined },
      ])
      expect(this.user_c_updates).to.deep.equal([
        { 'project:access:revoked': undefined },
      ])
    })
  })

  describe('event: project:publicAccessLevel:changed, set to tokenBased', function () {
    beforeEach(function (done) {
      /**
       * We turn on link sharing
       */
      rclient.publish(
        'editor-events',
        JSON.stringify({
          room_id: this.project_id,
          message: 'project:publicAccessLevel:changed',
          payload: [{ newAccessLevel: 'tokenBased' }],
        })
      )
      setTimeout(done, 200)
    })

    it('should not disconnect anyone', function () {
      expect(this.owner_client.socket.connected).to.equal(true)
      expect(this.user_a_client.socket.connected).to.equal(true)
      expect(this.user_b_client.socket.connected).to.equal(true)
      expect(this.user_c_client.socket.connected).to.equal(true)
    })

    it('should send the event to all non-restricted clients', function () {
      expect(this.owner_updates).to.deep.equal([
        {
          'project:publicAccessLevel:changed': { newAccessLevel: 'tokenBased' },
        },
      ])

      expect(this.user_a_updates).to.deep.equal([
        {
          'project:publicAccessLevel:changed': { newAccessLevel: 'tokenBased' },
        },
      ])

      expect(this.user_b_updates).to.deep.equal([
        {
          'project:publicAccessLevel:changed': { newAccessLevel: 'tokenBased' },
        },
      ])
      // restricted users don't receive this type of message
      expect(this.user_c_updates.length).to.equal(0)
    })
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

      expect(this.user_b_updates).to.deep.equal([
        { userRemovedFromProject: removedUserId },
      ])
    })

    it('should send a project:access:revoked message to the disconnected clients', function () {
      expect(this.user_a_updates).to.deep.equal([
        { 'project:access:revoked': undefined },
      ])
    })
  })
})
