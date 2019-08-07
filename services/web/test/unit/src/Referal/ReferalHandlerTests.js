/* eslint-disable
    handle-callback-err,
    max-len,
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
const assert = require('assert')
require('chai').should()
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Referal/ReferalHandler.js'
)

describe('Referal handler', function() {
  beforeEach(function() {
    this.User = { findById: sinon.stub() }
    this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        '../../models/User': {
          User: this.User
        }
      }
    })
    return (this.user_id = '12313')
  })

  describe('getting refered user_ids', function() {
    it('should get the user from mongo and return the refered users array', function(done) {
      const user = {
        refered_users: ['1234', '312312', '3213129'],
        refered_user_count: 3
      }
      this.User.findById.callsArgWith(1, null, user)

      return this.handler.getReferedUsers(
        this.user_id,
        (err, passedReferedUserIds, passedReferedUserCount) => {
          passedReferedUserIds.should.deep.equal(user.refered_users)
          passedReferedUserCount.should.equal(3)
          return done()
        }
      )
    })

    it('should return an empty array if it is not set', function(done) {
      const user = {}
      this.User.findById.callsArgWith(1, null, user)

      return this.handler.getReferedUsers(
        this.user_id,
        (err, passedReferedUserIds, passedReferedUserCount) => {
          passedReferedUserIds.length.should.equal(0)
          return done()
        }
      )
    })

    it('should return a zero count if netither it or the array are set', function(done) {
      const user = {}
      this.User.findById.callsArgWith(1, null, user)

      return this.handler.getReferedUsers(
        this.user_id,
        (err, passedReferedUserIds, passedReferedUserCount) => {
          passedReferedUserCount.should.equal(0)
          return done()
        }
      )
    })

    it('should return the array length if count is not set', function(done) {
      const user = { refered_users: ['1234', '312312', '3213129'] }
      this.User.findById.callsArgWith(1, null, user)

      return this.handler.getReferedUsers(
        this.user_id,
        (err, passedReferedUserIds, passedReferedUserCount) => {
          passedReferedUserCount.should.equal(3)
          return done()
        }
      )
    })

    it('should return the count if it differs from the array length', function(done) {
      const user = {
        refered_users: ['1234', '312312', '3213129'],
        refered_user_count: 5
      }
      this.User.findById.callsArgWith(1, null, user)

      return this.handler.getReferedUsers(
        this.user_id,
        (err, passedReferedUserIds, passedReferedUserCount) => {
          passedReferedUserCount.should.equal(5)
          return done()
        }
      )
    })
  })
})
