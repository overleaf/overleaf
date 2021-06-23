/* eslint-disable
    max-len,
    mocha/handle-done-callback,
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
const sinon = require('sinon')
const { expect } = require('chai')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionController'
const Errors = require('../../../../app/src/Features/Errors/Errors')
const SubscriptionErrors = require('../../../../app/src/Features/Subscription/Errors')

const mockSubscriptions = {
  'subscription-123-active': {
    uuid: 'subscription-123-active',
    plan: {
      name: 'Gold',
      plan_code: 'gold',
    },
    current_period_ends_at: new Date(),
    state: 'active',
    unit_amount_in_cents: 999,
    account: {
      account_code: 'user-123',
    },
  },
}

describe('SubscriptionController', function () {
  beforeEach(function () {
    this.user = {
      email: 'tom@yahoo.com',
      _id: 'one',
      signUpDate: new Date('2000-10-01'),
    }
    this.activeRecurlySubscription =
      mockSubscriptions['subscription-123-active']

    this.AuthenticationController = {
      getLoggedInUser: sinon.stub().callsArgWith(1, null, this.user),
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      getSessionUser: sinon.stub().returns(this.user),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    this.SubscriptionHandler = {
      createSubscription: sinon.stub().callsArgWith(3),
      updateSubscription: sinon.stub().callsArgWith(3),
      reactivateSubscription: sinon.stub().callsArgWith(1),
      cancelSubscription: sinon.stub().callsArgWith(1),
      syncSubscription: sinon.stub().yields(),
      attemptPaypalInvoiceCollection: sinon.stub().yields(),
      startFreeTrial: sinon.stub(),
      promises: {
        createSubscription: sinon.stub().resolves(),
        updateSubscription: sinon.stub().resolves(),
        reactivateSubscription: sinon.stub().resolves(),
        cancelSubscription: sinon.stub().resolves(),
        syncSubscription: sinon.stub().resolves(),
        attemptPaypalInvoiceCollection: sinon.stub().resolves(),
        startFreeTrial: sinon.stub().resolves(),
      },
    }

    this.PlansLocator = { findLocalPlanInSettings: sinon.stub() }

    this.LimitationsManager = {
      hasPaidSubscription: sinon.stub(),
      userHasV1OrV2Subscription: sinon.stub(),
      userHasV2Subscription: sinon.stub(),
      promises: {
        hasPaidSubscription: sinon.stub().resolves(),
        userHasV1OrV2Subscription: sinon.stub().resolves(),
        userHasV2Subscription: sinon.stub().resolves(),
      },
    }

    this.SubscriptionViewModelBuilder = {
      buildUsersSubscriptionViewModel: sinon.stub().callsArgWith(1, null, {}),
      buildPlansList: sinon.stub(),
      promises: {
        buildUsersSubscriptionViewModel: sinon.stub().resolves({}),
      },
    }
    this.settings = {
      coupon_codes: {
        upgradeToAnnualPromo: {
          student: 'STUDENTCODEHERE',
          collaborator: 'COLLABORATORCODEHERE',
        },
      },
      apis: {
        recurly: {
          subdomain: 'sl',
        },
      },
      siteUrl: 'http://de.sharelatex.dev:3000',
      gaExperiments: {},
    }
    this.GeoIpLookup = {
      getCurrencyCode: sinon.stub(),
      promises: {
        getCurrencyCode: sinon.stub(),
      },
    }
    this.UserGetter = {
      getUser: sinon.stub().callsArgWith(2, null, this.user),
      promises: {
        getUser: sinon.stub().resolves(this.user),
      },
    }
    this.SubscriptionController = SandboxedModule.require(modulePath, {
      requires: {
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        './SubscriptionHandler': this.SubscriptionHandler,
        './PlansLocator': this.PlansLocator,
        './SubscriptionViewModelBuilder': this.SubscriptionViewModelBuilder,
        './LimitationsManager': this.LimitationsManager,
        '../../infrastructure/GeoIpLookup': this.GeoIpLookup,
        'settings-sharelatex': this.settings,
        '../User/UserGetter': this.UserGetter,
        './RecurlyWrapper': (this.RecurlyWrapper = {
          updateAccountEmailAddress: sinon.stub().yields(),
        }),
        './FeaturesUpdater': (this.FeaturesUpdater = {}),
        './GroupPlansData': (this.GroupPlansData = {}),
        './V1SubscriptionManager': (this.V1SubscriptionManager = {}),
        '../Errors/HttpErrorHandler': (this.HttpErrorHandler = {
          unprocessableEntity: sinon.stub(),
        }),
        './Errors': SubscriptionErrors,
        '../Analytics/AnalyticsManager': (this.AnalyticsManager = {
          recordEvent: sinon.stub(),
          setUserProperty: sinon.stub(),
        }),
        '../SplitTests/SplitTestHandler': (this.SplitTestHandler = {
          getTestSegmentation: () => {},
        }),
      },
    })

    this.res = new MockResponse()
    this.req = new MockRequest()
    this.req.body = {}
    this.req.query = { planCode: '123123' }

    return (this.stubbedCurrencyCode = 'GBP')
  })

  describe('plansPage', function () {
    beforeEach(function () {
      this.req.ip = '1234.3123.3131.333 313.133.445.666 653.5345.5345.534'
      return this.GeoIpLookup.promises.getCurrencyCode.resolves({
        currencyCode: this.stubbedCurrencyCode,
      })
    })
  })

  describe('paymentPage', function () {
    beforeEach(function () {
      this.req.headers = {}
      this.SubscriptionHandler.promises.validateNoSubscriptionInRecurly = sinon
        .stub()
        .resolves(true)
      return this.GeoIpLookup.promises.getCurrencyCode.resolves({
        currencyCode: this.stubbedCurrencyCode,
      })
    })

    describe('with a user without a subscription', function () {
      beforeEach(function () {
        this.LimitationsManager.promises.userHasV1OrV2Subscription.resolves(
          false
        )
        return this.PlansLocator.findLocalPlanInSettings.returns({})
      })

      describe('with a valid plan code', function () {
        it('should render the new subscription page', function (done) {
          this.res.render = (page, opts) => {
            page.should.equal('subscriptions/new')
            done()
          }
          this.SubscriptionController.paymentPage(this.req, this.res)
        })
      })
    })

    describe('with a user with subscription', function () {
      it('should redirect to the subscription dashboard', function (done) {
        this.PlansLocator.findLocalPlanInSettings.returns({})
        this.LimitationsManager.promises.userHasV1OrV2Subscription.resolves(
          true
        )
        this.res.redirect = url => {
          url.should.equal('/user/subscription?hasSubscription=true')
          return done()
        }
        return this.SubscriptionController.paymentPage(this.req, this.res)
      })
    })

    describe('with an invalid plan code', function () {
      it('should return 422 error - Unprocessable Entity', function (done) {
        this.LimitationsManager.promises.userHasV1OrV2Subscription.resolves(
          false
        )
        this.PlansLocator.findLocalPlanInSettings.returns(null)
        this.HttpErrorHandler.unprocessableEntity = sinon.spy(
          (req, res, message) => {
            expect(req).to.exist
            expect(res).to.exist
            expect(message).to.deep.equal('Plan not found')
            done()
          }
        )
        return this.SubscriptionController.paymentPage(this.req, this.res)
      })
    })

    describe('which currency to use', function () {
      beforeEach(function () {
        this.LimitationsManager.promises.userHasV1OrV2Subscription.resolves(
          false
        )
        return this.PlansLocator.findLocalPlanInSettings.returns({})
      })

      it('should use the set currency from the query string', function (done) {
        this.req.query.currency = 'EUR'
        this.res.render = (page, opts) => {
          opts.currency.should.equal('EUR')
          opts.currency.should.not.equal(this.stubbedCurrencyCode)
          return done()
        }
        return this.SubscriptionController.paymentPage(this.req, this.res)
      })

      it('should upercase the currency code', function (done) {
        this.req.query.currency = 'eur'
        this.res.render = (page, opts) => {
          opts.currency.should.equal('EUR')
          return done()
        }
        return this.SubscriptionController.paymentPage(this.req, this.res)
      })

      it('should use the geo ip currency if non is provided', function (done) {
        this.req.query.currency = null
        this.res.render = (page, opts) => {
          opts.currency.should.equal(this.stubbedCurrencyCode)
          done()
        }
        this.SubscriptionController.paymentPage(this.req, this.res)
      })
    })

    describe('with a recurly subscription already', function () {
      it('should redirect to the subscription dashboard', function (done) {
        this.PlansLocator.findLocalPlanInSettings.returns({})
        this.LimitationsManager.promises.userHasV1OrV2Subscription.resolves(
          false
        )
        this.SubscriptionHandler.promises.validateNoSubscriptionInRecurly.resolves(
          false
        )
        this.res.redirect = url => {
          url.should.equal('/user/subscription?hasSubscription=true')
          return done()
        }
        return this.SubscriptionController.paymentPage(this.req, this.res)
      })
    })
  })

  describe('successfulSubscription', function () {
    beforeEach(function (done) {
      this.SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel.callsArgWith(
        1,
        null,
        {}
      )
      this.res.callback = done
      return this.SubscriptionController.successfulSubscription(
        this.req,
        this.res
      )
    })
  })

  describe('userSubscriptionPage', function () {
    beforeEach(function (done) {
      this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
        {
          personalSubscription: (this.personalSubscription = {
            'personal-subscription': 'mock',
          }),
          memberGroupSubscriptions: (this.memberGroupSubscriptions = {
            'group-subscriptions': 'mock',
          }),
        }
      )
      this.SubscriptionViewModelBuilder.buildPlansList.returns(
        (this.plans = { plans: 'mock' })
      )
      this.LimitationsManager.promises.userHasV1OrV2Subscription.resolves(false)
      this.res.render = (view, data) => {
        this.data = data
        expect(view).to.equal('subscriptions/dashboard')
        done()
      }
      this.SubscriptionController.userSubscriptionPage(this.req, this.res)
    })

    it('should load the personal, groups and v1 subscriptions', function () {
      expect(this.data.personalSubscription).to.deep.equal(
        this.personalSubscription
      )
      return expect(this.data.memberGroupSubscriptions).to.deep.equal(
        this.memberGroupSubscriptions
      )
    })

    it('should load the user', function () {
      return expect(this.data.user).to.deep.equal(this.user)
    })

    it('should load the plans', function () {
      return expect(this.data.plans).to.deep.equal(this.plans)
    })
  })

  describe('createSubscription', function () {
    beforeEach(function (done) {
      this.res = {
        sendStatus() {
          return done()
        },
      }
      sinon.spy(this.res, 'sendStatus')
      this.subscriptionDetails = {
        card: '1234',
        cvv: '123',
      }
      this.recurlyTokenIds = {
        billing: '1234',
        threeDSecureActionResult: '5678',
      }
      this.req.body.recurly_token_id = this.recurlyTokenIds.billing
      this.req.body.recurly_three_d_secure_action_result_token_id = this.recurlyTokenIds.threeDSecureActionResult
      this.req.body.subscriptionDetails = this.subscriptionDetails
      this.LimitationsManager.userHasV1OrV2Subscription.yields(null, false)
      return this.SubscriptionController.createSubscription(this.req, this.res)
    })

    it('should send the user and subscriptionId to the handler', function (done) {
      this.SubscriptionHandler.createSubscription
        .calledWithMatch(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds
        )
        .should.equal(true)
      return done()
    })

    it('should redurect to the subscription page', function (done) {
      this.res.sendStatus.calledWith(201).should.equal(true)
      return done()
    })
  })

  describe('createSubscription with errors', function () {
    it('should handle users with subscription', function (done) {
      this.LimitationsManager.userHasV1OrV2Subscription.yields(null, true)
      this.SubscriptionController.createSubscription(this.req, {
        sendStatus: status => {
          expect(status).to.equal(409)
          this.SubscriptionHandler.createSubscription.called.should.equal(false)

          done()
        },
      })
    })

    it('should handle 3DSecure errors', function (done) {
      this.next = sinon.stub()
      this.LimitationsManager.userHasV1OrV2Subscription.yields(null, false)
      this.SubscriptionHandler.createSubscription.yields(
        new SubscriptionErrors.RecurlyTransactionError({})
      )
      this.HttpErrorHandler.unprocessableEntity = sinon.spy(
        (req, res, message) => {
          expect(req).to.exist
          expect(res).to.exist
          expect(message).to.deep.equal('Unknown transaction error')
          done()
        }
      )
      this.SubscriptionController.createSubscription(this.req, this.res)
    })

    it('should handle validation errors', function (done) {
      this.next = sinon.stub()
      this.LimitationsManager.userHasV1OrV2Subscription.yields(null, false)
      this.SubscriptionHandler.createSubscription.yields(
        new Errors.InvalidError('invalid error test')
      )
      this.HttpErrorHandler.unprocessableEntity = sinon.spy(
        (req, res, message) => {
          expect(req).to.exist
          expect(res).to.exist
          expect(message).to.deep.equal('invalid error test')
          done()
        }
      )
      this.SubscriptionController.createSubscription(this.req, this.res)
    })

    it('should handle recurly errors', function (done) {
      this.LimitationsManager.userHasV1OrV2Subscription.yields(null, false)
      this.SubscriptionHandler.createSubscription.yields(
        new SubscriptionErrors.RecurlyTransactionError({})
      )

      this.HttpErrorHandler.unprocessableEntity = sinon.spy(
        (req, res, info) => {
          expect(req).to.exist
          expect(res).to.exist
          expect(info).to.deep.equal('Unknown transaction error')
          done()
        }
      )

      return this.SubscriptionController.createSubscription(this.req, this.res)
    })

    it('should handle invalid error', function (done) {
      this.LimitationsManager.userHasV1OrV2Subscription.yields(null, false)
      this.SubscriptionHandler.createSubscription.yields(
        new Errors.InvalidError({})
      )

      this.HttpErrorHandler.unprocessableEntity = sinon.spy((req, res) => {
        expect(req).to.exist
        expect(res).to.exist
        done()
      })

      return this.SubscriptionController.createSubscription(this.req, this.res)
    })
  })

  describe('updateSubscription via post', function () {
    beforeEach(function (done) {
      this.res = {
        redirect() {
          return done()
        },
      }
      sinon.spy(this.res, 'redirect')
      this.plan_code = '1234'
      this.req.body.plan_code = this.plan_code
      return this.SubscriptionController.updateSubscription(this.req, this.res)
    })

    it('should send the user and subscriptionId to the handler', function (done) {
      this.SubscriptionHandler.updateSubscription
        .calledWith(this.user, this.plan_code)
        .should.equal(true)
      return done()
    })

    it('should redurect to the subscription page', function (done) {
      this.res.redirect.calledWith('/user/subscription').should.equal(true)
      return done()
    })
  })

  describe('updateAccountEmailAddress via put', function () {
    it('should send the user and subscriptionId to RecurlyWrapper', function () {
      this.res.sendStatus = sinon.spy()
      this.SubscriptionController.updateAccountEmailAddress(this.req, this.res)
      this.RecurlyWrapper.updateAccountEmailAddress
        .calledWith(this.user._id, this.user.email)
        .should.equal(true)
    })

    it('should respond with 200', function () {
      this.res.sendStatus = sinon.spy()
      this.SubscriptionController.updateAccountEmailAddress(this.req, this.res)
      this.res.sendStatus.calledWith(200).should.equal(true)
    })

    it('should send the error to the next handler when updating recurly account email fails', function (done) {
      this.RecurlyWrapper.updateAccountEmailAddress.yields(new Error())
      this.next = sinon.spy(error => {
        expect(error).instanceOf(Error)
        done()
      })
      this.SubscriptionController.updateAccountEmailAddress(
        this.req,
        this.res,
        this.next
      )
    })
  })

  describe('reactivateSubscription', function () {
    beforeEach(function (done) {
      this.res = {
        redirect() {
          return done()
        },
      }
      sinon.spy(this.res, 'redirect')
      return this.SubscriptionController.reactivateSubscription(
        this.req,
        this.res
      )
    })

    it('should tell the handler to reactivate this user', function (done) {
      this.SubscriptionHandler.reactivateSubscription
        .calledWith(this.user)
        .should.equal(true)
      return done()
    })

    it('should redurect to the subscription page', function (done) {
      this.res.redirect.calledWith('/user/subscription').should.equal(true)
      return done()
    })
  })

  describe('cancelSubscription', function () {
    beforeEach(function (done) {
      this.res = {
        redirect() {
          return done()
        },
      }
      sinon.spy(this.res, 'redirect')
      return this.SubscriptionController.cancelSubscription(this.req, this.res)
    })

    it('should tell the handler to cancel this user', function (done) {
      this.SubscriptionHandler.cancelSubscription
        .calledWith(this.user)
        .should.equal(true)
      return done()
    })

    it('should redurect to the subscription page', function (done) {
      this.res.redirect
        .calledWith('/user/subscription/canceled')
        .should.equal(true)
      return done()
    })
  })

  describe('recurly callback', function () {
    describe('with a sync subscription request', function () {
      beforeEach(function (done) {
        this.req = {
          body: {
            expired_subscription_notification: {
              account: {
                account_code: this.user._id,
              },
              subscription: {
                uuid: this.activeRecurlySubscription.uuid,
                plan: {
                  plan_code: 'collaborator',
                  state: 'active',
                },
              },
            },
          },
        }
        this.res = {
          sendStatus() {
            return done()
          },
        }
        sinon.spy(this.res, 'sendStatus')
        return this.SubscriptionController.recurlyCallback(this.req, this.res)
      })

      it('should tell the SubscriptionHandler to process the recurly callback', function (done) {
        this.SubscriptionHandler.syncSubscription.called.should.equal(true)
        return done()
      })

      it('should send a 200', function (done) {
        this.res.sendStatus.calledWith(200)
        return done()
      })
    })

    describe('with a billing info updated request', function () {
      beforeEach(function (done) {
        this.req = {
          body: {
            billing_info_updated_notification: {
              account: {
                account_code: 'mock-account-code',
              },
            },
          },
        }
        this.res = {
          sendStatus() {
            done()
          },
        }
        sinon.spy(this.res, 'sendStatus')
        this.SubscriptionController.recurlyCallback(this.req, this.res)
      })

      it('should call attemptPaypalInvoiceCollection', function (done) {
        this.SubscriptionHandler.attemptPaypalInvoiceCollection
          .calledWith('mock-account-code')
          .should.equal(true)
        done()
      })

      it('should send a 200', function (done) {
        this.res.sendStatus.calledWith(200)
        done()
      })
    })

    describe('with a non-actionable request', function () {
      beforeEach(function (done) {
        this.user.id = this.activeRecurlySubscription.account.account_code
        this.req = {
          body: {
            renewed_subscription_notification: {
              account: {
                account_code: this.user._id,
              },
              subscription: {
                uuid: this.activeRecurlySubscription.uuid,
                plan: {
                  plan_code: 'collaborator',
                  state: 'active',
                },
              },
            },
          },
        }
        this.res = {
          sendStatus() {
            return done()
          },
        }
        sinon.spy(this.res, 'sendStatus')
        return this.SubscriptionController.recurlyCallback(this.req, this.res)
      })

      it('should not call the subscriptionshandler', function () {
        this.SubscriptionHandler.syncSubscription.called.should.equal(false)
        this.SubscriptionHandler.attemptPaypalInvoiceCollection.called.should.equal(
          false
        )
      })

      it('should respond with a 200 status', function () {
        return this.res.sendStatus.calledWith(200)
      })
    })
  })

  describe('renderUpgradeToAnnualPlanPage', function () {
    it('should redirect to the plans page if the user does not have a subscription', function (done) {
      this.LimitationsManager.userHasV2Subscription.callsArgWith(1, null, false)
      this.res.redirect = function (url) {
        url.should.equal('/user/subscription/plans')
        return done()
      }
      return this.SubscriptionController.renderUpgradeToAnnualPlanPage(
        this.req,
        this.res
      )
    })

    it('should pass the plan code to the view - student', function (done) {
      this.LimitationsManager.userHasV2Subscription.callsArgWith(
        1,
        null,
        true,
        { planCode: 'Student free trial 14 days' }
      )
      this.res.render = function (view, opts) {
        view.should.equal('subscriptions/upgradeToAnnual')
        opts.planName.should.equal('student')
        return done()
      }
      return this.SubscriptionController.renderUpgradeToAnnualPlanPage(
        this.req,
        this.res
      )
    })

    it('should pass the plan code to the view - collaborator', function (done) {
      this.LimitationsManager.userHasV2Subscription.callsArgWith(
        1,
        null,
        true,
        { planCode: 'free trial for Collaborator free trial 14 days' }
      )
      this.res.render = function (view, opts) {
        opts.planName.should.equal('collaborator')
        return done()
      }
      return this.SubscriptionController.renderUpgradeToAnnualPlanPage(
        this.req,
        this.res
      )
    })

    it('should pass annual as the plan name if the user is already on an annual plan', function (done) {
      this.LimitationsManager.userHasV2Subscription.callsArgWith(
        1,
        null,
        true,
        { planCode: 'student annual with free trial' }
      )
      this.res.render = function (view, opts) {
        opts.planName.should.equal('annual')
        return done()
      }
      return this.SubscriptionController.renderUpgradeToAnnualPlanPage(
        this.req,
        this.res
      )
    })
  })

  describe('processUpgradeToAnnualPlan', function () {
    beforeEach(function () {})

    it('should tell the subscription handler to update the subscription with the annual plan and apply a coupon code', function (done) {
      this.req.body = { planName: 'student' }

      this.res.sendStatus = () => {
        this.SubscriptionHandler.updateSubscription
          .calledWith(this.user, 'student-annual', 'STUDENTCODEHERE')
          .should.equal(true)
        return done()
      }

      return this.SubscriptionController.processUpgradeToAnnualPlan(
        this.req,
        this.res
      )
    })

    it('should get the collaborator coupon code', function (done) {
      this.req.body = { planName: 'collaborator' }

      this.res.sendStatus = url => {
        this.SubscriptionHandler.updateSubscription
          .calledWith(this.user, 'collaborator-annual', 'COLLABORATORCODEHERE')
          .should.equal(true)
        return done()
      }

      return this.SubscriptionController.processUpgradeToAnnualPlan(
        this.req,
        this.res
      )
    })
  })
})
