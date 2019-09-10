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
const should = require('chai').should()
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionLocator'
const { assert } = require('chai')
const { ObjectId } = require('mongoose').Types

describe('Subscription Locator Tests', function() {
  beforeEach(function() {
    this.user = { _id: '5208dd34438842e2db333333' }
    this.subscription = { hello: 'world' }
    this.Subscription = {
      findOne: sinon.stub(),
      find: sinon.stub()
    }
    this.DeletedSubscription = {
      findOne: sinon.stub().yields(),
      find: sinon.stub().yields()
    }
    return (this.SubscriptionLocator = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Subscription': {
          Subscription: this.Subscription
        },
        '../../models/DeletedSubscription': {
          DeletedSubscription: this.DeletedSubscription
        },
        'logger-sharelatex': {
          log() {}
        }
      }
    }))
  })

  describe('finding users subscription', function() {
    it('should send the users features', function(done) {
      this.Subscription.findOne.callsArgWith(1, null, this.subscription)
      return this.SubscriptionLocator.getUsersSubscription(
        this.user,
        (err, subscription) => {
          this.Subscription.findOne
            .calledWith({ admin_id: this.user._id })
            .should.equal(true)
          subscription.should.equal(this.subscription)
          return done()
        }
      )
    })

    it('should error if not found', function(done) {
      this.Subscription.findOne.callsArgWith(1, 'not found')
      return this.SubscriptionLocator.getUsersSubscription(
        this.user,
        (err, subscription) => {
          err.should.exist
          return done()
        }
      )
    })

    it('should take a user id rather than the user object', function(done) {
      this.Subscription.findOne.callsArgWith(1, null, this.subscription)
      return this.SubscriptionLocator.getUsersSubscription(
        this.user._id,
        (err, subscription) => {
          this.Subscription.findOne
            .calledWith({ admin_id: this.user._id })
            .should.equal(true)
          subscription.should.equal(this.subscription)
          return done()
        }
      )
    })

    describe('finding managed subscription', function() {
      it('should query the database', function(done) {
        this.Subscription.findOne.callsArgWith(1, null, this.subscription)
        return this.SubscriptionLocator.findManagedSubscription(
          this.user._id,
          (err, subscription) => {
            this.Subscription.findOne
              .calledWith({ manager_ids: this.user._id })
              .should.equal(true)
            subscription.should.equal(this.subscription)
            return done()
          }
        )
      })
    })
  })
})
