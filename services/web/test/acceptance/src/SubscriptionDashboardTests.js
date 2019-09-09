/* eslint-disable
    handle-callback-err,
    max-len,
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
const User = require('./helpers/User')
const { Subscription } = require('../../../app/src/models/Subscription')
const { Institution } = require('../../../app/src/models/Institution')
const SubscriptionViewModelBuilder = require('../../../app/src/Features/Subscription/SubscriptionViewModelBuilder')

const MockRecurlyApi = require('./helpers/MockRecurlyApi')
const MockV1Api = require('./helpers/MockV1Api')

describe('Subscriptions', function() {
  describe('dashboard', function() {
    beforeEach(function(done) {
      this.user = new User()
      return this.user.ensureUserExists(done)
    })

    describe('when the user has no subscription', function() {
      beforeEach(function(done) {
        return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
          this.user,
          (error, data) => {
            this.data = data
            if (error != null) {
              return done(error)
            }
            return done()
          }
        )
      })

      it('should return no personalSubscription', function() {
        return expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return no memberGroupSubscriptions', function() {
        return expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })
    })

    describe('when the user has a subscription with recurly', function() {
      beforeEach(function(done) {
        MockRecurlyApi.accounts['mock-account-id'] = this.accounts = {
          hosted_login_token: 'mock-login-token'
        }
        MockRecurlyApi.subscriptions[
          'mock-subscription-id'
        ] = this.subscription = {
          plan_code: 'collaborator',
          tax_in_cents: 100,
          tax_rate: 0.2,
          unit_amount_in_cents: 500,
          currency: 'GBP',
          current_period_ends_at: new Date(2018, 4, 5),
          state: 'active',
          account_id: 'mock-account-id',
          trial_ends_at: new Date(2018, 6, 7)
        }
        MockRecurlyApi.coupons = this.coupons = {
          'test-coupon-1': { description: 'Test Coupon 1' },
          'test-coupon-2': { description: 'Test Coupon 2' },
          'test-coupon-3': { name: 'TestCoupon3' }
        }
        Subscription.create(
          {
            admin_id: this.user._id,
            manager_ids: [this.user._id],
            recurlySubscription_id: 'mock-subscription-id',
            planCode: 'collaborator'
          },
          error => {
            if (error != null) {
              return done(error)
            }
            return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error != null) {
                  return done(error)
                }
                return done()
              }
            )
          }
        )
      })

      after(function(done) {
        MockRecurlyApi.accounts = {}
        MockRecurlyApi.subscriptions = {}
        MockRecurlyApi.coupons = {}
        MockRecurlyApi.redemptions = {}
        Subscription.remove(
          {
            admin_id: this.user._id
          },
          done
        )
      })

      it('should return a personalSubscription with populated recurly data', function() {
        const subscription = this.data.personalSubscription
        expect(subscription).to.exist
        expect(subscription.planCode).to.equal('collaborator')
        expect(subscription.recurly).to.exist
        return expect(subscription.recurly).to.deep.equal({
          activeCoupons: [],
          billingDetailsLink:
            'https://test.recurly.com/account/billing_info/edit?ht=mock-login-token',
          accountManagementLink:
            'https://test.recurly.com/account/mock-login-token',
          currency: 'GBP',
          nextPaymentDueAt: '5th May 2018',
          price: '£6.00',
          state: 'active',
          tax: 100,
          taxRate: 0.2,
          trial_ends_at: new Date(2018, 6, 7),
          trialEndsAtFormatted: '7th July 2018'
        })
      })

      it('should return no memberGroupSubscriptions', function() {
        return expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })

      it('should include redeemed coupons', function(done) {
        MockRecurlyApi.redemptions['mock-account-id'] = [
          { state: 'active', coupon_code: 'test-coupon-1' },
          { state: 'inactive', coupon_code: 'test-coupon-2' },
          { state: 'active', coupon_code: 'test-coupon-3' }
        ]

        // rebuild the view model with the redemptions
        return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
          this.user,
          (error, data) => {
            expect(error).to.not.exist
            expect(
              data.personalSubscription.recurly.activeCoupons
            ).to.deep.equal([
              {
                coupon_code: 'test-coupon-1',
                name: '',
                description: 'Test Coupon 1'
              },
              {
                coupon_code: 'test-coupon-3',
                name: 'TestCoupon3',
                description: ''
              }
            ])
            return done()
          }
        )
      })
    })

    describe('when the user has a subscription without recurly', function() {
      beforeEach(function(done) {
        Subscription.create(
          {
            admin_id: this.user._id,
            manager_ids: [this.user._id],
            planCode: 'collaborator'
          },
          error => {
            if (error != null) {
              return done(error)
            }
            return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error != null) {
                  return done(error)
                }
                return done()
              }
            )
          }
        )
      })

      after(function(done) {
        Subscription.remove(
          {
            admin_id: this.user._id
          },
          done
        )
      })

      it('should return a personalSubscription with no recurly data', function() {
        const subscription = this.data.personalSubscription
        expect(subscription).to.exist
        expect(subscription.planCode).to.equal('collaborator')
        return expect(subscription.recurly).to.not.exist
      })

      it('should return no memberGroupSubscriptions', function() {
        return expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })
    })

    describe('when the user is a member of a group subscription', function() {
      beforeEach(function(done) {
        this.owner1 = new User()
        this.owner2 = new User()
        async.series(
          [
            cb => this.owner1.ensureUserExists(cb),
            cb => this.owner2.ensureUserExists(cb),
            cb =>
              Subscription.create(
                {
                  admin_id: this.owner1._id,
                  manager_ids: [this.owner1._id],
                  planCode: 'collaborator',
                  groupPlan: true,
                  member_ids: [this.user._id]
                },
                cb
              ),
            cb =>
              Subscription.create(
                {
                  admin_id: this.owner2._id,
                  manager_ids: [this.owner2._id],
                  planCode: 'collaborator',
                  groupPlan: true,
                  member_ids: [this.user._id]
                },
                cb
              )
          ],
          error => {
            if (error != null) {
              return done(error)
            }
            return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error != null) {
                  return done(error)
                }
                return done()
              }
            )
          }
        )
      })

      after(function(done) {
        Subscription.remove(
          {
            admin_id: this.owner1._id
          },
          error => {
            if (error != null) {
              return done(error)
            }
            return Subscription.remove(
              {
                admin_id: this.owner2._id
              },
              done
            )
          }
        )
      })

      it('should return no personalSubscription', function() {
        return expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return the two memberGroupSubscriptions', function() {
        expect(this.data.memberGroupSubscriptions.length).to.equal(2)
        expect(
          // Mongoose populates the admin_id with the user
          this.data.memberGroupSubscriptions[0].admin_id._id.toString()
        ).to.equal(this.owner1._id)
        return expect(
          this.data.memberGroupSubscriptions[1].admin_id._id.toString()
        ).to.equal(this.owner2._id)
      })
    })

    describe('when the user is a manager of a group subscription', function() {
      beforeEach(function(done) {
        this.owner1 = new User()
        this.owner2 = new User()
        async.series(
          [
            cb => this.owner1.ensureUserExists(cb),
            cb => this.owner2.ensureUserExists(cb),
            cb =>
              Subscription.create(
                {
                  admin_id: this.owner1._id,
                  manager_ids: [this.owner1._id, this.user._id],
                  planCode: 'collaborator',
                  groupPlan: true
                },
                cb
              )
          ],
          error => {
            if (error != null) {
              return done(error)
            }
            return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error != null) {
                  return done(error)
                }
                return done()
              }
            )
          }
        )
      })

      after(function(done) {
        Subscription.remove(
          {
            admin_id: this.owner1._id
          },
          done
        )
      })

      it('should return no personalSubscription', function() {
        return expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return the managedGroupSubscriptions', function() {
        expect(this.data.managedGroupSubscriptions.length).to.equal(1)
        const subscription = this.data.managedGroupSubscriptions[0]
        expect(
          // Mongoose populates the admin_id with the user
          subscription.admin_id._id.toString()
        ).to.equal(this.owner1._id)
        return expect(subscription.groupPlan).to.equal(true)
      })
    })

    describe('when the user is a manager of an institution', function() {
      beforeEach(function(done) {
        this.v1Id = MockV1Api.nextV1Id()
        async.series(
          [
            cb => {
              return Institution.create(
                {
                  v1Id: this.v1Id,
                  managerIds: [this.user._id]
                },
                cb
              )
            }
          ],
          error => {
            if (error != null) {
              return done(error)
            }
            return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error != null) {
                  return done(error)
                }
                return done()
              }
            )
          }
        )
      })

      after(function(done) {
        Institution.remove(
          {
            v1Id: this.v1Id
          },
          done
        )
      })

      it('should return the managedInstitutions', function() {
        expect(this.data.managedInstitutions.length).to.equal(1)
        const institution = this.data.managedInstitutions[0]
        expect(institution.v1Id).to.equal(this.v1Id)
        return expect(institution.name).to.equal(`Institution ${this.v1Id}`)
      })
    })

    describe('when the user is a member of an affiliation', function() {
      beforeEach(function(done) {
        const v1Id = MockV1Api.nextV1Id()
        MockV1Api.setUser(v1Id, {
          subscription: {},
          subscription_status: {}
        })
        MockV1Api.setAffiliations([
          {
            email: 'confirmed-affiliation-email@stanford.example.edu',
            institution: {
              name: 'Stanford',
              licence: 'pro_plus',
              confirmed: true
            }
          },
          {
            email: 'unconfirmed-affiliation-email@harvard.example.edu',
            institution: {
              name: 'Harvard',
              licence: 'pro_plus',
              confirmed: true
            }
          },
          {
            email: 'confirmed-affiliation-email@mit.example.edu',
            institution: { name: 'MIT', licence: 'pro_plus', confirmed: false }
          }
        ])
        return async.series(
          [
            cb => {
              return this.user.setV1Id(v1Id, cb)
            },
            cb => {
              return this.user.addEmail(
                'unconfirmed-affiliation-email@harvard.example.edu',
                cb
              )
            },
            cb => {
              return this.user.addEmail(
                'confirmed-affiliation-email@stanford.example.edu',
                cb
              )
            },
            cb => {
              return this.user.confirmEmail(
                'confirmed-affiliation-email@stanford.example.edu',
                cb
              )
            },
            cb => {
              return this.user.addEmail(
                'confirmed-affiliation-email@mit.example.edu',
                cb
              )
            },
            cb => {
              return this.user.confirmEmail(
                'confirmed-affiliation-email@mit.example.edu',
                cb
              )
            }
          ],
          error => {
            if (error != null) {
              return done(error)
            }
            return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error != null) {
                  return done(error)
                }
                return done()
              }
            )
          }
        )
      })

      it('should return only the affilations with confirmed institutions, and confirmed emails', function() {
        return expect(this.data.confirmedMemberInstitutions).to.deep.equal([
          { name: 'Stanford', licence: 'pro_plus', confirmed: true }
        ])
      })
    })

    describe('when the user has a v1 subscription', function() {
      beforeEach(function(done) {
        let v1Id
        MockV1Api.setUser((v1Id = MockV1Api.nextV1Id()), {
          subscription: (this.subscription = {
            trial: false,
            has_plan: true,
            teams: [
              {
                id: 56,
                name: 'Test team'
              }
            ]
          }),
          subscription_status: (this.subscription_status = {
            product: { mock: 'product' },
            team: null
          })
        })
        return this.user.setV1Id(v1Id, error => {
          if (error != null) {
            return done(error)
          }
          return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
            this.user,
            (error, data) => {
              this.data = data
              if (error != null) {
                return done(error)
              }
              return done()
            }
          )
        })
      })

      it('should return no personalSubscription', function() {
        return expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return no memberGroupSubscriptions', function() {
        return expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })

      it('should return a v1SubscriptionStatus', function() {
        return expect(this.data.v1SubscriptionStatus).to.deep.equal(
          this.subscription_status
        )
      })
    })
  })

  describe('canceling', function() {
    beforeEach(function(done) {
      let v1Id
      this.user = new User()
      MockV1Api.setUser((v1Id = MockV1Api.nextV1Id()), (this.v1_user = {}))
      return async.series(
        [cb => this.user.login(cb), cb => this.user.setV1Id(v1Id, cb)],
        error => {
          return this.user.request(
            {
              method: 'POST',
              url: '/user/subscription/v1/cancel'
            },
            (error, response) => {
              this.response = response
              if (error != null) {
                return done(error)
              }
              return done()
            }
          )
        }
      )
    })

    it('should tell v1 to cancel the subscription', function() {
      return expect(this.v1_user.canceled).to.equal(true)
    })

    it('should redirect to the subscription dashboard', function() {
      expect(this.response.statusCode).to.equal(302)
      return expect(this.response.headers.location).to.equal(
        '/user/subscription'
      )
    })
  })
})
