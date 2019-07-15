/* eslint-disable
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
  '../../../../app/src/Features/Referal/ReferalFeatures.js'
)

describe('ReferalFeatures', function() {
  beforeEach(function() {
    this.ReferalFeatures = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/User': {
          User: (this.User = {})
        },
        'settings-sharelatex': (this.Settings = {}),
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
    this.callback = sinon.stub()
    this.referal_id = 'referal-id-123'
    this.referal_medium = 'twitter'
    this.user_id = 'user-id-123'
    return (this.new_user_id = 'new-user-id-123')
  })

  describe('getBonusFeatures', function() {
    beforeEach(function() {
      this.refered_user_count = 3
      this.Settings.bonus_features = {
        '3': {
          collaborators: 3,
          dropbox: false,
          versioning: false
        }
      }
      const stubbedUser = {
        refered_user_count: this.refered_user_count,
        features: { collaborators: 1, dropbox: false, versioning: false }
      }

      this.User.findOne = sinon.stub().callsArgWith(1, null, stubbedUser)
      return this.ReferalFeatures.getBonusFeatures(this.user_id, this.callback)
    })

    it('should get the users number of refered user', function() {
      return this.User.findOne
        .calledWith({ _id: this.user_id })
        .should.equal(true)
    })

    it('should call the callback with the features', function() {
      return this.callback
        .calledWith(null, this.Settings.bonus_features[3])
        .should.equal(true)
    })
  })

  describe('when the user is not at a bonus level', function() {
    beforeEach(function() {
      this.refered_user_count = 0
      this.Settings.bonus_features = {
        '1': {
          collaborators: 3,
          dropbox: false,
          versioning: false
        }
      }
      this.User.findOne = sinon
        .stub()
        .callsArgWith(1, null, { refered_user_count: this.refered_user_count })
      return this.ReferalFeatures.getBonusFeatures(this.user_id, this.callback)
    })

    it('should get the users number of refered user', function() {
      return this.User.findOne
        .calledWith({ _id: this.user_id })
        .should.equal(true)
    })

    it('should call the callback with no features', function() {
      return this.callback.calledWith(null, {}).should.equal(true)
    })
  })
})
