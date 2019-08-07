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
const should = require('chai').should()
const sinon = require('sinon')
const { assert } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupController'
const MockResponse = require('../helpers/MockResponse')

describe('SubscriptionGroupController', function() {
  beforeEach(function() {
    this.user = { _id: '!@312431', email: 'user@email.com' }
    this.adminUserId = '123jlkj'
    this.subscriptionId = '123434325412'
    this.user_email = 'bob@gmail.com'
    this.req = {
      session: {
        user: {
          _id: this.adminUserId,
          email: this.user_email
        }
      },
      params: {
        subscriptionId: this.subscriptionId
      },
      query: {}
    }

    this.subscription = {
      _id: this.subscriptionId
    }

    this.GroupHandler = { removeUserFromGroup: sinon.stub().callsArgWith(2) }

    this.SubscriptionLocator = {
      findManagedSubscription: sinon
        .stub()
        .callsArgWith(1, null, this.subscription)
    }

    this.AuthenticationController = {
      getLoggedInUserId(req) {
        return req.session.user._id
      },
      getSessionUser(req) {
        return req.session.user
      }
    }

    return (this.Controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './SubscriptionGroupHandler': this.GroupHandler,
        'logger-sharelatex': {
          log() {}
        },
        './SubscriptionLocator': this.SubscriptionLocator,
        '../Authentication/AuthenticationController': this
          .AuthenticationController
      }
    }))
  })

  describe('removeUserFromGroup', function() {
    it('should use the subscription id for the logged in user and take the user id from the params', function(done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription

      const res = {
        send: () => {
          this.GroupHandler.removeUserFromGroup
            .calledWith(this.subscriptionId, userIdToRemove)
            .should.equal(true)
          return done()
        }
      }
      return this.Controller.removeUserFromGroup(this.req, res)
    })
  })
})
