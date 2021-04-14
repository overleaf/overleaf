const { expect } = require('chai')
const async = require('async')
const UserHelper = require('./helpers/UserHelper')
const { Subscription } = require('../../../app/src/models/Subscription')
const { Institution } = require('../../../app/src/models/Institution')
const SubscriptionViewModelBuilder = require('../../../app/src/Features/Subscription/SubscriptionViewModelBuilder')
const RecurlySubscription = require('./helpers/RecurlySubscription')
const MockRecurlyApiClass = require('./mocks/MockRecurlyApi')
const MockV1ApiClass = require('./mocks/MockV1Api')

async function buildUsersSubscriptionViewModelPromise(userId) {
  return new Promise((resolve, reject) => {
    SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
      userId,
      (error, data) => {
        if (error) reject(error)
        resolve(data)
      }
    )
  })
}

let MockV1Api, MockRecurlyApi

before(function () {
  MockV1Api = MockV1ApiClass.instance()
  MockRecurlyApi = MockRecurlyApiClass.instance()
})

describe('Subscriptions', function () {
  describe('dashboard', function () {
    let userHelper
    beforeEach(async function () {
      userHelper = await UserHelper.createUser()
      this.user = userHelper.user
    })

    it('should not list personal plan', function () {
      const plans = SubscriptionViewModelBuilder.buildPlansList()
      expect(plans.individualMonthlyPlans).to.be.a('Array')
      const personalMonthlyPlan = plans.individualMonthlyPlans.find(
        plan => plan.planCode === 'personal'
      )
      expect(personalMonthlyPlan).to.be.undefined
    })

    describe('when the user has no subscription', function () {
      beforeEach(function (done) {
        SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
          this.user,
          (error, data) => {
            this.data = data
            if (error) {
              return done(error)
            }
            done()
          }
        )
      })

      it('should return no personalSubscription', function () {
        expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return no memberGroupSubscriptions', function () {
        expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })
    })

    describe('when the user has a subscription with recurly', function () {
      beforeEach(function (done) {
        this.recurlySubscription = new RecurlySubscription({
          adminId: this.user._id,
          planCode: 'collaborator',
          tax_in_cents: 100,
          tax_rate: 0.2,
          unit_amount_in_cents: 500,
          currency: 'GBP',
          current_period_ends_at: new Date(2018, 4, 5),
          state: 'active',
          trial_ends_at: new Date(2018, 6, 7),
          account: {
            hosted_login_token: 'mock-login-token',
            email: 'mock@email.com'
          }
        })
        MockRecurlyApi.coupons = this.coupons = {
          'test-coupon-1': { description: 'Test Coupon 1' },
          'test-coupon-2': { description: 'Test Coupon 2' },
          'test-coupon-3': { name: 'TestCoupon3' }
        }
        this.recurlySubscription.ensureExists(error => {
          if (error) {
            return done(error)
          }
          SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
            this.user,
            (error, data) => {
              this.data = data
              if (error) {
                return done(error)
              }
              done()
            }
          )
        })
      })

      after(function (done) {
        MockRecurlyApi.mockSubscriptions = []
        MockRecurlyApi.coupons = {}
        MockRecurlyApi.redemptions = {}
        Subscription.deleteOne(
          {
            admin_id: this.user._id
          },
          done
        )
      })

      it('should return a personalSubscription with populated recurly data', function () {
        const subscription = this.data.personalSubscription
        expect(subscription).to.exist
        expect(subscription.planCode).to.equal('collaborator')
        expect(subscription.recurly).to.exist
        expect(subscription.recurly).to.deep.equal({
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
          trialEndsAtFormatted: '7th July 2018',
          account: {
            account_code: this.user._id.toString(),
            email: 'mock@email.com',
            hosted_login_token: 'mock-login-token'
          },
          additionalLicenses: 0,
          totalLicenses: 0
        })
      })

      it('should return no memberGroupSubscriptions', function () {
        expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })

      it('should include redeemed coupons', function (done) {
        MockRecurlyApi.redemptions[this.user._id] = [
          { state: 'active', coupon_code: 'test-coupon-1' },
          { state: 'inactive', coupon_code: 'test-coupon-2' },
          { state: 'active', coupon_code: 'test-coupon-3' }
        ]

        // rebuild the view model with the redemptions
        SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
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
            done()
          }
        )
      })

      it('should return Recurly account email', function () {
        expect(this.data.personalSubscription.recurly.account.email).to.equal(
          'mock@email.com'
        )
      })
    })

    describe('when the user has a subscription without recurly', function () {
      beforeEach(function (done) {
        Subscription.create(
          {
            admin_id: this.user._id,
            manager_ids: [this.user._id],
            planCode: 'collaborator'
          },
          error => {
            if (error) {
              return done(error)
            }
            SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error) {
                  return done(error)
                }
                done()
              }
            )
          }
        )
      })

      after(function (done) {
        Subscription.deleteOne(
          {
            admin_id: this.user._id
          },
          done
        )
      })

      it('should return a personalSubscription with no recurly data', function () {
        const subscription = this.data.personalSubscription
        expect(subscription).to.exist
        expect(subscription.planCode).to.equal('collaborator')
        expect(subscription.recurly).to.not.exist
      })

      it('should return no memberGroupSubscriptions', function () {
        expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })
    })

    describe('when the user is a member of a group subscription', function () {
      beforeEach(async function () {
        const userHelperOwner1 = await UserHelper.createUser()
        const userHelperOwner2 = await UserHelper.createUser()
        this.owner1 = userHelperOwner1.user
        this.owner2 = userHelperOwner2.user

        await Subscription.create({
          admin_id: this.owner1._id,
          manager_ids: [this.owner1._id],
          planCode: 'collaborator',
          groupPlan: true,
          member_ids: [this.user._id]
        })
        await Subscription.create({
          admin_id: this.owner2._id,
          manager_ids: [this.owner2._id],
          planCode: 'collaborator',
          groupPlan: true,
          member_ids: [this.user._id]
        })
        this.data = await buildUsersSubscriptionViewModelPromise(this.user._id)
      })

      after(function (done) {
        Subscription.deleteOne(
          {
            admin_id: this.owner1._id
          },
          error => {
            if (error) {
              return done(error)
            }
            Subscription.deleteOne(
              {
                admin_id: this.owner2._id
              },
              done
            )
          }
        )
      })

      it('should return no personalSubscription', function () {
        expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return the two memberGroupSubscriptions', function () {
        expect(this.data.memberGroupSubscriptions.length).to.equal(2)
        expect(
          // Mongoose populates the admin_id with the user
          this.data.memberGroupSubscriptions[0].admin_id._id.toString()
        ).to.equal(this.owner1._id.toString())
        expect(
          this.data.memberGroupSubscriptions[1].admin_id._id.toString()
        ).to.equal(this.owner2._id.toString())
      })
    })

    describe('when the user is a manager of a group subscription', function () {
      beforeEach(async function () {
        const userHelperOwner1 = await UserHelper.createUser()
        const userHelperOwner2 = await UserHelper.createUser()
        this.owner1 = userHelperOwner1.user
        this.owner2 = userHelperOwner2.user

        await Subscription.create({
          admin_id: this.owner1._id,
          manager_ids: [this.owner1._id, this.user._id],
          planCode: 'collaborator',
          groupPlan: true
        })
        this.data = await buildUsersSubscriptionViewModelPromise(this.user._id)
      })

      after(function (done) {
        Subscription.deleteOne(
          {
            admin_id: this.owner1._id
          },
          done
        )
      })

      it('should return no personalSubscription', function () {
        expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return the managedGroupSubscriptions', function () {
        expect(this.data.managedGroupSubscriptions.length).to.equal(1)
        const subscription = this.data.managedGroupSubscriptions[0]
        expect(
          // Mongoose populates the admin_id with the user
          subscription.admin_id._id.toString()
        ).to.equal(this.owner1._id.toString())
        expect(subscription.groupPlan).to.equal(true)
      })
    })

    describe('when the user is a manager of an institution', function () {
      beforeEach(function (done) {
        this.v1Id = MockV1Api.nextV1Id()
        async.series(
          [
            cb => {
              Institution.create(
                {
                  v1Id: this.v1Id,
                  managerIds: [this.user._id]
                },
                cb
              )
            }
          ],
          error => {
            if (error) {
              return done(error)
            }
            SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
              this.user,
              (error, data) => {
                this.data = data
                if (error) {
                  return done(error)
                }
                done()
              }
            )
          }
        )
      })

      after(function (done) {
        Institution.deleteOne(
          {
            v1Id: this.v1Id
          },
          done
        )
      })

      it('should return the managedInstitutions', function () {
        expect(this.data.managedInstitutions.length).to.equal(1)
        const institution = this.data.managedInstitutions[0]
        expect(institution.v1Id).to.equal(this.v1Id)
        expect(institution.name).to.equal(`Institution ${this.v1Id}`)
      })
    })

    describe('when the user is a member of an affiliation', function () {
      beforeEach(async function () {
        const v1Id = MockV1Api.nextV1Id()
        MockV1Api.setUser(v1Id, {
          subscription: {},
          subscription_status: {}
        })
        await UserHelper.updateUser(this.user._id, {
          $set: { overleaf: { id: v1Id } }
        })

        const harvardDomain = 'harvard.example.edu'
        const mitDomain = 'mit.example.edu'
        const stanfordDomain = 'stanford.example.edu'
        const harvardId = MockV1Api.createInstitution({
          name: 'Harvard',
          hostname: harvardDomain
        })
        const mitId = MockV1Api.createInstitution({
          name: 'MIT',
          hostname: mitDomain
        })
        const stanfordId = MockV1Api.createInstitution({
          name: 'Stanford',
          hostname: stanfordDomain
        })
        MockV1Api.updateInstitutionDomain(harvardId, harvardDomain, {
          confirmed: true
        })
        MockV1Api.updateInstitutionDomain(mitId, mitDomain, {
          confirmed: false
        })
        MockV1Api.updateInstitutionDomain(stanfordId, stanfordDomain, {
          confirmed: true
        })
        this.harvardEmail = `unconfirmed-affiliation-email@${harvardDomain}`
        this.stanfordEmail = `confirmed-affiliation-email@${stanfordDomain}`
        const mitEmail = `confirmed-affiliation-email@${mitDomain}`
        userHelper = await UserHelper.loginUser(
          userHelper.getDefaultEmailPassword()
        )
        await userHelper.addEmail(this.harvardEmail)
        await userHelper.addEmailAndConfirm(this.user._id, this.stanfordEmail)
        await userHelper.addEmailAndConfirm(this.user._id, mitEmail)
        this.data = await buildUsersSubscriptionViewModelPromise(this.user._id)
      })

      it('should return only the affilations with confirmed institutions, and confirmed emails', function () {
        expect(this.data.confirmedMemberAffiliations.length).to.equal(1)
        expect(
          this.data.confirmedMemberAffiliations[0].institution.name
        ).to.equal('Stanford')
      })
    })

    describe('when the user has a v1 subscription', function () {
      beforeEach(async function () {
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
        await UserHelper.updateUser(this.user._id, {
          $set: {
            overleaf: {
              id: v1Id
            }
          }
        })
        this.data = await buildUsersSubscriptionViewModelPromise(this.user._id)
      })

      it('should return no personalSubscription', function () {
        expect(this.data.personalSubscription).to.equal(null)
      })

      it('should return no memberGroupSubscriptions', function () {
        expect(this.data.memberGroupSubscriptions).to.deep.equal([])
      })

      it('should return a v1SubscriptionStatus', function () {
        expect(this.data.v1SubscriptionStatus).to.deep.equal(
          this.subscription_status
        )
      })
    })
  })

  describe('canceling', function () {
    let userHelper, v1Id
    beforeEach(async function () {
      v1Id = MockV1Api.nextV1Id()
      console.log('v1Id=', v1Id)
      userHelper = await UserHelper.createUser({ overleaf: { id: v1Id } })
      this.user = userHelper.user
      MockV1Api.setUser(v1Id, (this.v1_user = {}))

      userHelper = await UserHelper.loginUser(
        userHelper.getDefaultEmailPassword()
      )
      this.response = await userHelper.request.post(
        '/user/subscription/v1/cancel',
        {
          simple: false
        }
      )
    })

    it('should tell v1 to cancel the subscription', function () {
      expect(this.v1_user.canceled).to.equal(true)
    })

    it('should redirect to the subscription dashboard', function () {
      expect(this.response.statusCode).to.equal(302)
      expect(this.response.headers.location).to.equal('/user/subscription')
    })
  })
})
