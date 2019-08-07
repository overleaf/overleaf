/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const { ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipsHandler'
const SandboxedModule = require('sandboxed-module')

describe('UserMembershipsHandler', function() {
  beforeEach(function() {
    this.user = { _id: ObjectId() }

    this.Institution = { updateMany: sinon.stub().yields(null) }
    this.Subscription = { updateMany: sinon.stub().yields(null) }
    this.Publisher = { updateMany: sinon.stub().yields(null) }
    return (this.UserMembershipsHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Institution': {
          Institution: this.Institution
        },
        '../../models/Subscription': {
          Subscription: this.Subscription
        },
        '../../models/Publisher': {
          Publisher: this.Publisher
        }
      }
    }))
  })

  describe('remove user', function() {
    it('remove user from all entities', function(done) {
      return this.UserMembershipsHandler.removeUserFromAllEntities(
        this.user._id,
        error => {
          assertCalledWith(
            this.Institution.updateMany,
            {},
            { $pull: { managerIds: this.user._id } }
          )
          assertCalledWith(
            this.Subscription.updateMany,
            {},
            { $pull: { manager_ids: this.user._id } }
          )
          assertCalledWith(
            this.Publisher.updateMany,
            {},
            { $pull: { managerIds: this.user._id } }
          )
          return done()
        }
      )
    })
  })
})
