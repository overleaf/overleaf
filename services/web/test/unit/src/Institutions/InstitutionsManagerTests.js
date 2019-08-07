/* eslint-disable
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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsManager'
)
const { expect } = require('chai')

describe('InstitutionsManager', function() {
  beforeEach(function() {
    this.institutionId = 123
    this.logger = { log() {} }
    this.user = {}
    this.getInstitutionAffiliations = sinon.stub()
    this.refreshFeatures = sinon.stub().yields()
    this.UserGetter = {
      getUsersByAnyConfirmedEmail: sinon.stub().yields(),
      getUser: sinon.stub().callsArgWith(1, null, this.user)
    }
    this.creator = { create: sinon.stub().callsArg(0) }
    this.NotificationsBuilder = {
      featuresUpgradedByAffiliation: sinon.stub().returns(this.creator),
      redundantPersonalSubscription: sinon.stub().returns(this.creator)
    }
    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub().callsArg(1)
    }
    this.institutionWithV1Data = { name: 'Wombat University' }
    this.institution = {
      fetchV1Data: sinon
        .stub()
        .callsArgWith(0, null, this.institutionWithV1Data)
    }
    this.InstitutionModel = {
      Institution: {
        findOne: sinon.stub().callsArgWith(1, null, this.institution)
      }
    }
    this.subscriptionExec = sinon.stub().yields()
    const SubscriptionModel = {
      Subscription: {
        find: () => {
          return {
            populate: () => {
              return { exec: this.subscriptionExec }
            }
          }
        }
      }
    }
    this.Mongo = { ObjectId: sinon.stub().returnsArg(0) }

    return (this.InstitutionsManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': this.logger,
        './InstitutionsAPI': {
          getInstitutionAffiliations: this.getInstitutionAffiliations
        },
        '../Subscription/FeaturesUpdater': {
          refreshFeatures: this.refreshFeatures
        },
        '../User/UserGetter': this.UserGetter,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../../models/Institution': this.InstitutionModel,
        '../../models/Subscription': SubscriptionModel,
        '../../infrastructure/mongojs': this.Mongo
      }
    }))
  })

  describe('upgradeInstitutionUsers', function() {
    beforeEach(function() {
      this.user1Id = '123abc123abc123abc123abc'
      this.user2Id = '456def456def456def456def'
      this.affiliations = [{ user_id: this.user1Id }, { user_id: this.user2Id }]
      this.user1 = { _id: this.user1Id }
      this.user2 = { _id: this.user2Id }
      this.subscription = {
        planCode: 'pro',
        groupPlan: false
      }
      this.UserGetter.getUser
        .withArgs(this.user1Id)
        .callsArgWith(1, null, this.user1)
      this.UserGetter.getUser
        .withArgs(this.user2Id)
        .callsArgWith(1, null, this.user2)
      this.SubscriptionLocator.getUsersSubscription
        .withArgs(this.user2)
        .callsArgWith(1, null, this.subscription)
      this.refreshFeatures.withArgs(this.user1Id).yields(null, {}, true)
      return this.getInstitutionAffiliations.yields(null, this.affiliations)
    })

    it('refresh all users Features', function(done) {
      return this.InstitutionsManager.upgradeInstitutionUsers(
        this.institutionId,
        error => {
          should.not.exist(error)
          sinon.assert.calledTwice(this.refreshFeatures)
          return done()
        }
      )
    })

    it('notifies users if their features have been upgraded', function(done) {
      return this.InstitutionsManager.upgradeInstitutionUsers(
        this.institutionId,
        error => {
          should.not.exist(error)
          sinon.assert.calledOnce(
            this.NotificationsBuilder.featuresUpgradedByAffiliation
          )
          sinon.assert.calledWith(
            this.NotificationsBuilder.featuresUpgradedByAffiliation,
            this.affiliations[0],
            this.user1
          )
          return done()
        }
      )
    })

    it('notifies users if they have a subscription that should be cancelled', function(done) {
      return this.InstitutionsManager.upgradeInstitutionUsers(
        this.institutionId,
        error => {
          should.not.exist(error)
          sinon.assert.calledOnce(
            this.NotificationsBuilder.redundantPersonalSubscription
          )
          sinon.assert.calledWith(
            this.NotificationsBuilder.redundantPersonalSubscription,
            this.affiliations[1],
            this.user2
          )
          return done()
        }
      )
    })
  })

  describe('checkInstitutionUsers', function() {
    it('check all users Features', function(done) {
      const affiliations = [{ email: 'foo@bar.com' }, { email: 'baz@boo.edu' }]
      const stubbedUsers = [
        {
          _id: '123abc123abc123abc123abc',
          features: { collaborators: -1, trackChanges: true }
        },
        {
          _id: '456def456def456def456def',
          features: { collaborators: 10, trackChanges: false }
        },
        {
          _id: '789def789def789def789def',
          features: { collaborators: -1, trackChanges: false }
        }
      ]
      this.getInstitutionAffiliations.yields(null, affiliations)
      this.UserGetter.getUsersByAnyConfirmedEmail.yields(null, stubbedUsers)
      return this.InstitutionsManager.checkInstitutionUsers(
        this.institutionId,
        (error, usersSummary) => {
          should.not.exist(error)
          usersSummary.totalConfirmedUsers.should.equal(3)
          usersSummary.totalConfirmedProUsers.should.equal(1)
          usersSummary.totalConfirmedNonProUsers.should.equal(2)
          expect(usersSummary.confirmedNonProUsers).to.deep.equal([
            '456def456def456def456def',
            '789def789def789def789def'
          ])
          return done()
        }
      )
    })
  })

  describe('getInstitutionUsersSubscriptions', function() {
    it('returns all institution users subscriptions', function(done) {
      const stubbedUsers = [
        { user_id: '123abc123abc123abc123abc' },
        { user_id: '456def456def456def456def' },
        { user_id: '789def789def789def789def' }
      ]
      this.getInstitutionAffiliations.yields(null, stubbedUsers)
      return this.InstitutionsManager.getInstitutionUsersSubscriptions(
        this.institutionId,
        (error, subscriptions) => {
          should.not.exist(error)
          sinon.assert.calledOnce(this.subscriptionExec)
          return done()
        }
      )
    })
  })
})
