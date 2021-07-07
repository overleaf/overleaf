const { expect } = require('chai')
const UserHelper = require('./helpers/UserHelper')
const settings = require('@overleaf/settings')
const { ObjectId } = require('mongodb')
const { Subscription } = require('../../../app/src/models/Subscription')
const { User } = require('../../../app/src/models/User')
const FeaturesUpdater = require('../../../app/src/Features/Subscription/FeaturesUpdater')

const MockV1ApiClass = require('./mocks/MockV1Api')
const logger = require('logger-sharelatex')
logger.logger.level('error')

let MockV1Api

before(function () {
  MockV1Api = MockV1ApiClass.instance()
})

const syncUserAndGetFeatures = function (user, callback) {
  FeaturesUpdater.refreshFeatures(user._id, 'test', error => {
    if (error) {
      return callback(error)
    }
    User.findById(user._id, (error, user) => {
      if (error) {
        return callback(error)
      }
      const { features } = user.toObject()
      delete features.$init // mongoose internals
      callback(null, features)
    })
  })
}

describe('FeatureUpdater.refreshFeatures', function () {
  let userHelper, user
  beforeEach(async function () {
    userHelper = await UserHelper.createUser()
    user = userHelper.user
  })

  describe('when user has no subscriptions', function () {
    it('should set their features to the basic set', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        expect(features).to.deep.equal(settings.defaultFeatures)
        done()
      })
    })
  })

  describe('when the user has an individual subscription', function () {
    beforeEach(function () {
      Subscription.create({
        admin_id: user._id,
        manager_ids: [user._id],
        planCode: 'collaborator',
        customAccount: true,
      })
    }) // returns a promise

    it('should set their features to the upgraded set', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        const plan = settings.plans.find(
          plan => plan.planCode === 'collaborator'
        )
        expect(features).to.deep.equal(plan.features)
        done()
      })
    })
  })

  describe('when the user is in a group subscription', function () {
    beforeEach(function () {
      const groupAdminId = ObjectId()
      Subscription.create({
        admin_id: groupAdminId,
        manager_ids: [groupAdminId],
        member_ids: [user._id],
        groupAccount: true,
        planCode: 'collaborator',
        customAccount: true,
      })
    }) // returns a promise

    it('should set their features to the upgraded set', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        const plan = settings.plans.find(
          plan => plan.planCode === 'collaborator'
        )
        expect(features).to.deep.equal(plan.features)
        done()
      })
    })
  })

  describe('when the user has bonus features', function () {
    beforeEach(function () {
      return User.updateOne(
        {
          _id: user._id,
        },
        {
          refered_user_count: 10,
        }
      )
    }) // returns a promise

    it('should set their features to the bonus set', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        expect(features).to.deep.equal(
          Object.assign(
            {},
            settings.defaultFeatures,
            settings.bonus_features[9]
          )
        )
        done()
      })
    })
  })

  describe('when the user has affiliations', function () {
    let email2, institutionId, hostname
    beforeEach(async function () {
      institutionId = MockV1Api.createInstitution({ commonsAccount: true })
      hostname = 'institution.edu'
      MockV1Api.addInstitutionDomain(institutionId, hostname, {
        confirmed: true,
      })
      email2 = `${user._id}@${hostname}`
      userHelper = await UserHelper.loginUser(
        userHelper.getDefaultEmailPassword()
      )
      await userHelper.addEmail(email2)
      this.institutionPlan = settings.plans.find(
        plan => plan.planCode === settings.institutionPlanCode
      )
    })

    it('should not set their features if email is not confirmed', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        expect(features).to.deep.equal(settings.defaultFeatures)
        done()
      })
    })

    describe('when email is confirmed', function () {
      beforeEach(async function () {
        await userHelper.confirmEmail(user._id, email2)
      })

      it('should set their features', function (done) {
        syncUserAndGetFeatures(user, (error, features) => {
          expect(features).to.deep.equal(this.institutionPlan.features)
          done()
        })
      })

      describe('when domain is not confirmed as part of institution', function () {
        beforeEach(function () {
          MockV1Api.updateInstitutionDomain(institutionId, hostname, {
            confirmed: false,
          })
        })
        it('should not set their features', function (done) {
          syncUserAndGetFeatures(user, (error, features) => {
            expect(features).to.deep.equal(settings.defaultFeatures)
            done()
          })
        })
      })
    })
  })

  describe('when the user is due bonus features and has extra features that no longer apply', function () {
    beforeEach(function () {
      return User.updateOne(
        {
          _id: user._id,
        },
        {
          refered_user_count: 10,
          'features.github': true,
        }
      )
    }) // returns a promise

    it('should set their features to the bonus set and downgrade the extras', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        expect(features).to.deep.equal(
          Object.assign(
            {},
            settings.defaultFeatures,
            settings.bonus_features[9]
          )
        )
        done()
      })
    })
  })

  describe('when the user has a v1 plan', function () {
    beforeEach(function () {
      MockV1Api.setUser(42, { plan_name: 'free' })
      return User.updateOne(
        {
          _id: user._id,
        },
        {
          overleaf: {
            id: 42,
          },
        }
      )
    }) // returns a promise

    it('should set their features to the v1 plan', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        const plan = settings.plans.find(plan => plan.planCode === 'v1_free')
        expect(features).to.deep.equal(plan.features)
        done()
      })
    })
  })

  describe('when the user has a v1 plan and bonus features', function () {
    beforeEach(function () {
      MockV1Api.setUser(42, { plan_name: 'free' })
      return User.updateOne(
        {
          _id: user._id,
        },
        {
          overleaf: {
            id: 42,
          },
          refered_user_count: 10,
        }
      )
    }) // returns a promise

    it('should set their features to the best of the v1 plan and bonus features', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        const v1plan = settings.plans.find(plan => plan.planCode === 'v1_free')
        const expectedFeatures = Object.assign(
          {},
          v1plan.features,
          settings.bonus_features[9]
        )
        expect(features).to.deep.equal(expectedFeatures)
        done()
      })
    })
  })

  describe('when the user has a group and personal subscription', function () {
    beforeEach(function (done) {
      const groupAdminId = ObjectId()

      Subscription.create(
        {
          admin_id: user._id,
          manager_ids: [user._id],
          planCode: 'professional',
          customAccount: true,
        },
        error => {
          if (error) {
            throw error
          }
          Subscription.create(
            {
              admin_id: groupAdminId,
              manager_ids: [groupAdminId],
              member_ids: [user._id],
              groupAccount: true,
              planCode: 'collaborator',
              customAccount: true,
            },
            done
          )
        }
      )
    })

    it('should set their features to the best set', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        const plan = settings.plans.find(
          plan => plan.planCode === 'professional'
        )
        expect(features).to.deep.equal(plan.features)
        done()
      })
    })
  })

  describe('when the notifyV1Flag is passed', function () {
    beforeEach(function () {
      User.updateOne(
        {
          _id: user._id,
        },
        {
          overleaf: {
            id: 42,
          },
        }
      )
    }) // returns a promise
  })

  describe('when the user has features overrides', function () {
    beforeEach(function () {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      return User.updateOne(
        {
          _id: user._id,
        },
        {
          featuresOverrides: [
            {
              features: {
                github: true,
              },
            },
            {
              features: {
                dropbox: true,
              },
              expiresAt: new Date(1990, 12, 25),
            },
            {
              features: {
                trackChanges: true,
              },
              expiresAt: futureDate,
            },
          ],
        }
      )
    }) // returns a promise

    it('should set their features to the overridden set', function (done) {
      syncUserAndGetFeatures(user, (error, features) => {
        if (error) {
          throw error
        }
        const expectedFeatures = Object.assign(settings.defaultFeatures, {
          github: true,
          trackChanges: true,
        })
        expect(features).to.deep.equal(expectedFeatures)
        done()
      })
    })
  })

  it('should update featuresUpdatedAt', async function () {
    user = (await UserHelper.getUser({ _id: user._id })).user
    expect(user.featuresUpdatedAt).to.not.exist // no default set
    await FeaturesUpdater.promises.refreshFeatures(user._id, 'test')
    user = (await UserHelper.getUser({ _id: user._id })).user
    const featuresUpdatedAt = user.featuresUpdatedAt
    expect(featuresUpdatedAt).to.exist
    // refresh again
    await FeaturesUpdater.promises.refreshFeatures(user._id, 'test')
    user = (await UserHelper.getUser({ _id: user._id })).user
    expect(user.featuresUpdatedAt > featuresUpdatedAt).to.be.true
  })
})
