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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const async = require('async')
const UserClient = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')
const { ObjectId } = require('../../../app/src/infrastructure/mongojs')
const { Subscription } = require('../../../app/src/models/Subscription')
const { User } = require('../../../app/src/models/User')
const FeaturesUpdater = require('../../../app/src/Features/Subscription/FeaturesUpdater')

const MockV1Api = require('./helpers/MockV1Api')
const logger = require('logger-sharelatex')
logger.logger.level('error')

const syncUserAndGetFeatures = function(user, callback) {
  if (callback == null) {
    callback = function(error, features) {}
  }
  return FeaturesUpdater.refreshFeatures(user._id, error => {
    if (error != null) {
      return callback(error)
    }
    return User.findById(user._id, (error, user) => {
      if (error != null) {
        return callback(error)
      }
      const { features } = user.toObject()
      delete features.$init // mongoose internals
      return callback(null, features)
    })
  })
}

describe('FeatureUpdater.refreshFeatures', function() {
  beforeEach(function(done) {
    this.user = new UserClient()
    return this.user.ensureUserExists(error => {
      if (error != null) {
        throw error
      }
      return done()
    })
  })

  describe('when user has no subscriptions', function() {
    it('should set their features to the basic set', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        expect(features).to.deep.equal(settings.defaultFeatures)
        return done()
      })
    })
  })

  describe('when the user has an individual subscription', function() {
    beforeEach(function() {
      return Subscription.create({
        admin_id: this.user._id,
        manager_ids: [this.user._id],
        planCode: 'collaborator',
        customAccount: true
      })
    }) // returns a promise

    it('should set their features to the upgraded set', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        const plan = settings.plans.find(
          plan => plan.planCode === 'collaborator'
        )
        expect(features).to.deep.equal(plan.features)
        return done()
      })
    })
  })

  describe('when the user is in a group subscription', function() {
    beforeEach(function() {
      const groupAdminId = ObjectId()
      return Subscription.create({
        admin_id: groupAdminId,
        manager_ids: [groupAdminId],
        member_ids: [this.user._id],
        groupAccount: true,
        planCode: 'collaborator',
        customAccount: true
      })
    }) // returns a promise

    it('should set their features to the upgraded set', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        const plan = settings.plans.find(
          plan => plan.planCode === 'collaborator'
        )
        expect(features).to.deep.equal(plan.features)
        return done()
      })
    })
  })

  describe('when the user has bonus features', function() {
    beforeEach(function() {
      return User.update(
        {
          _id: this.user._id
        },
        {
          refered_user_count: 10
        }
      )
    }) // returns a promise

    it('should set their features to the bonus set', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        expect(features).to.deep.equal(
          Object.assign(
            {},
            settings.defaultFeatures,
            settings.bonus_features[9]
          )
        )
        return done()
      })
    })
  })

  describe('when the user has affiliations', function() {
    beforeEach(function() {
      this.institutionPlan = settings.plans.find(
        plan => plan.planCode === settings.institutionPlanCode
      )
      this.email = this.user.emails[0].email
      return (this.affiliationData = {
        email: this.email,
        institution: { licence: 'pro_plus', confirmed: true }
      })
    })

    it('should not set their features if email is not confirmed', function(done) {
      MockV1Api.setAffiliations([this.affiliationData])
      return syncUserAndGetFeatures(this.user, (error, features) => {
        expect(features).to.deep.equal(settings.defaultFeatures)
        return done()
      })
    })

    it('should set their features if email is confirmed', function(done) {
      MockV1Api.setAffiliations([this.affiliationData])
      return this.user.confirmEmail(this.email, error => {
        return syncUserAndGetFeatures(this.user, (error, features) => {
          expect(features).to.deep.equal(this.institutionPlan.features)
          return done()
        })
      })
    })

    it('should not set their features if institution is not confirmed', function(done) {
      this.affiliationData.institution.confirmed = false
      MockV1Api.setAffiliations([this.affiliationData])
      return this.user.confirmEmail(this.email, error => {
        return syncUserAndGetFeatures(this.user, (error, features) => {
          expect(features).to.deep.equal(settings.defaultFeatures)
          return done()
        })
      })
    })
  })

  describe('when the user is due bonus features and has extra features that no longer apply', function() {
    beforeEach(function() {
      return User.update(
        {
          _id: this.user._id
        },
        {
          refered_user_count: 10,
          'features.github': true
        }
      )
    }) // returns a promise

    it('should set their features to the bonus set and downgrade the extras', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        expect(features).to.deep.equal(
          Object.assign(
            {},
            settings.defaultFeatures,
            settings.bonus_features[9]
          )
        )
        return done()
      })
    })
  })

  describe('when the user has a v1 plan', function() {
    beforeEach(function() {
      MockV1Api.setUser(42, { plan_name: 'free' })
      return User.update(
        {
          _id: this.user._id
        },
        {
          overleaf: {
            id: 42
          }
        }
      )
    }) // returns a promise

    it('should set their features to the v1 plan', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        const plan = settings.plans.find(plan => plan.planCode === 'v1_free')
        expect(features).to.deep.equal(plan.features)
        return done()
      })
    })
  })

  describe('when the user has a v1 plan and bonus features', function() {
    beforeEach(function() {
      MockV1Api.setUser(42, { plan_name: 'free' })
      return User.update(
        {
          _id: this.user._id
        },
        {
          overleaf: {
            id: 42
          },
          refered_user_count: 10
        }
      )
    }) // returns a promise

    it('should set their features to the best of the v1 plan and bonus features', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        const v1plan = settings.plans.find(plan => plan.planCode === 'v1_free')
        const expectedFeatures = Object.assign(
          {},
          v1plan.features,
          settings.bonus_features[9]
        )
        expect(features).to.deep.equal(expectedFeatures)
        return done()
      })
    })
  })

  describe('when the user has a group and personal subscription', function() {
    beforeEach(function(done) {
      const groupAdminId = ObjectId()

      Subscription.create(
        {
          admin_id: this.user._id,
          manager_ids: [this.user._id],
          planCode: 'professional',
          customAccount: true
        },
        error => {
          if (error != null) {
            throw error
          }
          return Subscription.create(
            {
              admin_id: groupAdminId,
              manager_ids: [groupAdminId],
              member_ids: [this.user._id],
              groupAccount: true,
              planCode: 'collaborator',
              customAccount: true
            },
            done
          )
        }
      )
    })

    it('should set their features to the best set', function(done) {
      return syncUserAndGetFeatures(this.user, (error, features) => {
        if (error != null) {
          throw error
        }
        const plan = settings.plans.find(
          plan => plan.planCode === 'professional'
        )
        expect(features).to.deep.equal(plan.features)
        return done()
      })
    })
  })

  describe('when the notifyV1Flag is passed', function() {
    beforeEach(function() {
      return User.update(
        {
          _id: this.user._id
        },
        {
          overleaf: {
            id: 42
          }
        }
      )
    }) // returns a promise
  })
})
