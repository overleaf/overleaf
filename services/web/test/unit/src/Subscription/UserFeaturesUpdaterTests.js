/* eslint-disable
    camelcase,
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
const should = require('chai').should()
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/UserFeaturesUpdater'
const { assert } = require('chai')

describe('UserFeaturesUpdater', function() {
  beforeEach(function() {
    this.User = { update: sinon.stub().callsArgWith(2) }
    return (this.UserFeaturesUpdater = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/User': {
          User: this.User
        },
        'logger-sharelatex': {
          log() {}
        }
      }
    }))
  })

  describe('updateFeatures', function() {
    it('should send the users features', function(done) {
      const user_id = '5208dd34438842e2db000005'
      this.features = { versioning: true, collaborators: 10 }
      return this.UserFeaturesUpdater.updateFeatures(
        user_id,
        this.features,
        (err, features) => {
          const update = {
            'features.versioning': true,
            'features.collaborators': 10
          }
          this.User.update
            .calledWith({ _id: user_id }, update)
            .should.equal(true)
          features.should.deep.equal(this.features)
          return done()
        }
      )
    })
  })
})
