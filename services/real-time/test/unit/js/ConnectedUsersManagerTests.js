/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const SandboxedModule = require('sandboxed-module')
const assert = require('node:assert')
const path = require('node:path')
const sinon = require('sinon')
const modulePath = path.join(__dirname, '../../../app/js/ConnectedUsersManager')
const { expect } = require('chai')
const tk = require('timekeeper')

describe('ConnectedUsersManager', function () {
  beforeEach(function () {
    this.settings = {
      redis: {
        realtime: {
          key_schema: {
            clientsInProject({ project_id: projectId }) {
              return `clients_in_project:${projectId}`
            },
            connectedUser({ project_id: projectId, client_id: clientId }) {
              return `connected_user:${projectId}:${clientId}`
            },
          },
        },
      },
    }
    this.rClient = {
      auth() {},
      setex: sinon.stub(),
      sadd: sinon.stub(),
      get: sinon.stub(),
      srem: sinon.stub(),
      del: sinon.stub(),
      smembers: sinon.stub(),
      expire: sinon.stub(),
      hset: sinon.stub(),
      hgetall: sinon.stub(),
      exec: sinon.stub(),
      multi: () => {
        return this.rClient
      },
    }
    tk.freeze(new Date())

    this.ConnectedUsersManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        '@overleaf/redis-wrapper': {
          createClient: () => {
            return this.rClient
          },
        },
      },
    })
    this.client_id = '32132132'
    this.project_id = 'dskjh2u21321'
    this.user = {
      _id: 'user-id-123',
      first_name: 'Joe',
      last_name: 'Bloggs',
      email: 'joe@example.com',
    }
    return (this.cursorData = {
      row: 12,
      column: 9,
      doc_id: '53c3b8c85fee64000023dc6e',
    })
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('updateUserPosition', function () {
    beforeEach(function () {
      return this.rClient.exec.callsArgWith(0)
    })

    it('should set a key with the date and give it a ttl', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.hset
            .calledWith(
              `connected_user:${this.project_id}:${this.client_id}`,
              'last_updated_at',
              Date.now()
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should set a key with the user_id', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.hset
            .calledWith(
              `connected_user:${this.project_id}:${this.client_id}`,
              'user_id',
              this.user._id
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should set a key with the first_name', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.hset
            .calledWith(
              `connected_user:${this.project_id}:${this.client_id}`,
              'first_name',
              this.user.first_name
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should set a key with the last_name', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.hset
            .calledWith(
              `connected_user:${this.project_id}:${this.client_id}`,
              'last_name',
              this.user.last_name
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should set a key with the email', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.hset
            .calledWith(
              `connected_user:${this.project_id}:${this.client_id}`,
              'email',
              this.user.email
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should push the client_id on to the project list', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.sadd
            .calledWith(`clients_in_project:${this.project_id}`, this.client_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should add a ttl to the project set so it stays clean', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.expire
            .calledWith(
              `clients_in_project:${this.project_id}`,
              24 * 4 * 60 * 60
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should add a ttl to the connected user so it stays clean', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        null,
        err => {
          if (err) return done(err)
          this.rClient.expire
            .calledWith(
              `connected_user:${this.project_id}:${this.client_id}`,
              60 * 15
            )
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should set the cursor position when provided', function (done) {
      return this.ConnectedUsersManager.updateUserPosition(
        this.project_id,
        this.client_id,
        this.user,
        this.cursorData,
        err => {
          if (err) return done(err)
          this.rClient.hset
            .calledWith(
              `connected_user:${this.project_id}:${this.client_id}`,
              'cursorData',
              JSON.stringify(this.cursorData)
            )
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('markUserAsDisconnected', function () {
    beforeEach(function () {
      return this.rClient.exec.callsArgWith(0)
    })

    it('should remove the user from the set', function (done) {
      return this.ConnectedUsersManager.markUserAsDisconnected(
        this.project_id,
        this.client_id,
        err => {
          if (err) return done(err)
          this.rClient.srem
            .calledWith(`clients_in_project:${this.project_id}`, this.client_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should delete the connected_user string', function (done) {
      return this.ConnectedUsersManager.markUserAsDisconnected(
        this.project_id,
        this.client_id,
        err => {
          if (err) return done(err)
          this.rClient.del
            .calledWith(`connected_user:${this.project_id}:${this.client_id}`)
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should add a ttl to the connected user set so it stays clean', function (done) {
      return this.ConnectedUsersManager.markUserAsDisconnected(
        this.project_id,
        this.client_id,
        err => {
          if (err) return done(err)
          this.rClient.expire
            .calledWith(
              `clients_in_project:${this.project_id}`,
              24 * 4 * 60 * 60
            )
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('_getConnectedUser', function () {
    it('should return a connected user if there is a user object', function (done) {
      const cursorData = JSON.stringify({ cursorData: { row: 1 } })
      this.rClient.hgetall.callsArgWith(1, null, {
        connected_at: new Date(),
        user_id: this.user._id,
        last_updated_at: `${Date.now()}`,
        cursorData,
      })
      return this.ConnectedUsersManager._getConnectedUser(
        this.project_id,
        this.client_id,
        (err, result) => {
          if (err) return done(err)
          result.connected.should.equal(true)
          result.client_id.should.equal(this.client_id)
          return done()
        }
      )
    })

    it('should return a not connected user if there is no object', function (done) {
      this.rClient.hgetall.callsArgWith(1, null, null)
      return this.ConnectedUsersManager._getConnectedUser(
        this.project_id,
        this.client_id,
        (err, result) => {
          if (err) return done(err)
          result.connected.should.equal(false)
          result.client_id.should.equal(this.client_id)
          return done()
        }
      )
    })

    return it('should return a not connected user if there is an empty object', function (done) {
      this.rClient.hgetall.callsArgWith(1, null, {})
      return this.ConnectedUsersManager._getConnectedUser(
        this.project_id,
        this.client_id,
        (err, result) => {
          if (err) return done(err)
          result.connected.should.equal(false)
          result.client_id.should.equal(this.client_id)
          return done()
        }
      )
    })
  })

  return describe('getConnectedUsers', function () {
    beforeEach(function () {
      this.users = ['1234', '5678', '9123', '8234']
      this.rClient.smembers.callsArgWith(1, null, this.users)
      this.ConnectedUsersManager._getConnectedUser = sinon.stub()
      this.ConnectedUsersManager._getConnectedUser
        .withArgs(this.project_id, this.users[0])
        .callsArgWith(2, null, {
          connected: true,
          client_age: 2,
          client_id: this.users[0],
        })
      this.ConnectedUsersManager._getConnectedUser
        .withArgs(this.project_id, this.users[1])
        .callsArgWith(2, null, {
          connected: false,
          client_age: 1,
          client_id: this.users[1],
        })
      this.ConnectedUsersManager._getConnectedUser
        .withArgs(this.project_id, this.users[2])
        .callsArgWith(2, null, {
          connected: true,
          client_age: 3,
          client_id: this.users[2],
        })
      return this.ConnectedUsersManager._getConnectedUser
        .withArgs(this.project_id, this.users[3])
        .callsArgWith(2, null, {
          connected: true,
          client_age: 11,
          client_id: this.users[3],
        })
    }) // connected but old

    return it('should only return the users in the list which are still in redis and recently updated', function (done) {
      return this.ConnectedUsersManager.getConnectedUsers(
        this.project_id,
        (err, users) => {
          if (err) return done(err)
          users.length.should.equal(2)
          users[0].should.deep.equal({
            client_id: this.users[0],
            client_age: 2,
            connected: true,
          })
          users[1].should.deep.equal({
            client_id: this.users[2],
            client_age: 3,
            connected: true,
          })
          return done()
        }
      )
    })
  })
})
