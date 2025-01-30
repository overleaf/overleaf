const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert, expect } = require('chai')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionController'
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
      emails: [{ email: 'tom@yahoo.com', confirmedAt: new Date('2000-10-02') }],
    }
    this.activeRecurlySubscription =
      mockSubscriptions['subscription-123-active']

    this.SessionManager = {
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
        pauseSubscription: sinon.stub().resolves(),
        resumeSubscription: sinon.stub().resolves(),
        syncSubscription: sinon.stub().resolves(),
        attemptPaypalInvoiceCollection: sinon.stub().resolves(),
        startFreeTrial: sinon.stub().resolves(),
      },
    }

    this.LimitationsManager = {
      hasPaidSubscription: sinon.stub(),
      userHasSubscription: sinon
        .stub()
        .yields(null, { hasSubscription: false }),
      promises: {
        hasPaidSubscription: sinon.stub().resolves(),
        userHasSubscription: sinon.stub().resolves({ hasSubscription: false }),
      },
    }

    this.SubscriptionViewModelBuilder = {
      buildUsersSubscriptionViewModel: sinon.stub().callsArgWith(1, null, {}),
      buildPlansList: sinon.stub(),
      promises: {
        buildUsersSubscriptionViewModel: sinon.stub().resolves({}),
        getBestSubscription: sinon.stub().resolves({}),
      },
      buildPlansListForSubscriptionDash: sinon
        .stub()
        .returns({ plans: [], planCodesChangingAtTermEnd: [] }),
    }
    this.settings = {
      coupon_codes: {
        upgradeToAnnualPromo: {
          student: 'STUDENTCODEHERE',
          collaborator: 'COLLABORATORCODEHERE',
        },
      },
      groupPlanModalOptions: {
        plan_codes: [],
        currencies: [
          {
            display: 'GBP (£)',
            code: 'GBP',
          },
        ],
        sizes: ['42'],
        sizesForHighDenominationCurrencies: ['42'],
        usages: [{ code: 'foo', display: 'Foo' }],
      },
      apis: {
        recurly: {
          subdomain: 'sl',
        },
      },
      siteUrl: 'http://de.overleaf.dev:3000',
    }
    this.AuthorizationManager = {
      promises: {
        isUserSiteAdmin: sinon.stub().resolves(false),
      },
    }
    this.GeoIpLookup = {
      isValidCurrencyParam: sinon.stub().returns(true),
      getCurrencyCode: sinon.stub().yields('USD', 'US'),
      promises: {
        getCurrencyCode: sinon.stub().resolves({
          countryCode: 'US',
          currencyCode: 'USD',
        }),
      },
    }
    this.UserGetter = {
      getUser: sinon.stub().callsArgWith(2, null, this.user),
      promises: {
        getUser: sinon.stub().resolves(this.user),
      },
    }
    this.SplitTestV2Hander = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
    }
    this.Features = {
      hasFeature: sinon.stub().returns(false),
    }
    this.SubscriptionController = SandboxedModule.require(modulePath, {
      requires: {
        '../Authorization/AuthorizationManager': this.AuthorizationManager,
        '../SplitTests/SplitTestHandler': this.SplitTestV2Hander,
        '../Authentication/SessionManager': this.SessionManager,
        './SubscriptionHandler': this.SubscriptionHandler,
        './SubscriptionHelper': this.SubscriptionHelper,
        './SubscriptionViewModelBuilder': this.SubscriptionViewModelBuilder,
        './LimitationsManager': this.LimitationsManager,
        '../../infrastructure/GeoIpLookup': this.GeoIpLookup,
        '@overleaf/settings': this.settings,
        '../User/UserGetter': this.UserGetter,
        './RecurlyWrapper': (this.RecurlyWrapper = {
          updateAccountEmailAddress: sinon.stub().yields(),
        }),
        './RecurlyEventHandler': {
          sendRecurlyAnalyticsEvent: sinon.stub().resolves(),
        },
        './FeaturesUpdater': (this.FeaturesUpdater = {}),
        './GroupPlansData': (this.GroupPlansData = {}),
        './V1SubscriptionManager': (this.V1SubscriptionManager = {}),
        '../Errors/HttpErrorHandler': (this.HttpErrorHandler = {
          unprocessableEntity: sinon.stub().callsFake((req, res, message) => {
            res.status(422)
            res.json({ message })
          }),
          badRequest: sinon.stub().callsFake((req, res, message) => {
            res.status(400)
            res.json({ message })
          }),
        }),
        './Errors': SubscriptionErrors,
        '../Analytics/AnalyticsManager': (this.AnalyticsManager = {
          recordEventForUser: sinon.stub(),
          recordEventForUserInBackground: sinon.stub(),
          recordEventForSession: sinon.stub(),
          setUserPropertyForUser: sinon.stub(),
        }),
        '../../infrastructure/Modules': {
          promises: { hooks: { fire: sinon.stub().resolves() } },
        },
        '../../infrastructure/Features': this.Features,
        '../../util/currency': (this.currency = {
          formatCurrency: sinon.stub(),
        }),
      },
    })

    this.res = new MockResponse()
    this.req = new MockRequest()
    this.req.body = {}
    this.req.query = { planCode: '123123' }

    this.stubbedCurrencyCode = 'GBP'
  })

  describe('successfulSubscription', function () {
    it('without a personal subscription', function (done) {
      this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
        {}
      )
      this.res.redirect = url => {
        url.should.equal('/user/subscription/plans')
        done()
      }
      this.SubscriptionController.successfulSubscription(this.req, this.res)
    })

    it('with a personal subscription', function (done) {
      this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
        {
          personalSubscription: 'foo',
        }
      )
      this.res.render = (url, variables) => {
        url.should.equal('subscriptions/successful-subscription-react')
        assert.deepEqual(variables, {
          title: 'thank_you',
          personalSubscription: 'foo',
          postCheckoutRedirect: undefined,
          user: this.user,
        })
        done()
      }
      this.SubscriptionController.successfulSubscription(this.req, this.res)
    })

    it('with an error', function (done) {
      this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
        undefined
      )
      this.SubscriptionController.successfulSubscription(
        this.req,
        this.res,
        error => {
          assert.isNotNull(error)
          done()
        }
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
      this.SubscriptionViewModelBuilder.buildPlansListForSubscriptionDash.returns(
        {
          plans: this.plans,
          planCodesChangingAtTermEnd: [],
        }
      )
      this.LimitationsManager.promises.userHasSubscription.resolves({
        hasSubscription: false,
      })
      this.res.render = (view, data) => {
        this.data = data
        expect(view).to.equal('subscriptions/dashboard-react')
        done()
      }
      this.SubscriptionController.userSubscriptionPage(this.req, this.res, done)
    })

    it('should load the personal, groups and v1 subscriptions', function () {
      expect(this.data.personalSubscription).to.deep.equal(
        this.personalSubscription
      )
      expect(this.data.memberGroupSubscriptions).to.deep.equal(
        this.memberGroupSubscriptions
      )
    })

    it('should load the user', function () {
      expect(this.data.user).to.deep.equal(this.user)
    })

    it('should load the plans', function () {
      expect(this.data.plans).to.deep.equal(this.plans)
    })

    it('should load an empty list of groups with settings available', function () {
      expect(this.data.groupSettingsEnabledFor).to.deep.equal([])
    })
  })

  describe('updateSubscription via post', function () {
    beforeEach(function (done) {
      this.res = {
        redirect() {
          done()
        },
      }
      sinon.spy(this.res, 'redirect')
      this.plan_code = '1234'
      this.req.body.plan_code = this.plan_code
      this.SubscriptionController.updateSubscription(this.req, this.res)
    })

    it('should send the user and subscriptionId to the handler', function (done) {
      this.SubscriptionHandler.updateSubscription
        .calledWith(this.user, this.plan_code)
        .should.equal(true)
      done()
    })

    it('should redurect to the subscription page', function (done) {
      this.res.redirect.calledWith('/user/subscription').should.equal(true)
      done()
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
    describe('when the user has permission', function () {
      beforeEach(function (done) {
        this.res = {
          redirect() {
            done()
          },
        }
        this.req.assertPermission = sinon.stub()
        this.next = sinon.stub().callsFake(error => {
          done(error)
        })
        sinon.spy(this.res, 'redirect')
        this.SubscriptionController.reactivateSubscription(
          this.req,
          this.res,
          this.next
        )
      })

      it('should assert the user has permission to reactivate their subscription', function (done) {
        this.req.assertPermission
          .calledWith('reactivate-subscription')
          .should.equal(true)
        done()
      })

      it('should tell the handler to reactivate this user', function (done) {
        this.SubscriptionHandler.reactivateSubscription
          .calledWith(this.user)
          .should.equal(true)
        done()
      })

      it('should redurect to the subscription page', function (done) {
        this.res.redirect.calledWith('/user/subscription').should.equal(true)
        done()
      })
    })

    describe('when the user does not have permission', function () {
      beforeEach(function (done) {
        this.res = {
          redirect() {
            done()
          },
        }
        this.req.assertPermission = sinon.stub().throws()
        this.next = sinon.stub().callsFake(() => {
          done()
        })
        sinon.spy(this.res, 'redirect')
        this.SubscriptionController.reactivateSubscription(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not reactivate the user', function (done) {
        this.req.assertPermission = sinon.stub().throws()
        this.SubscriptionHandler.reactivateSubscription.called.should.equal(
          false
        )
        done()
      })

      it('should call next with an error', function (done) {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
        done()
      })
    })
  })

  describe('pauseSubscription', function () {
    it('should throw an error if no pause length is provided', async function () {
      this.res = new MockResponse()
      this.req = new MockRequest()
      this.next = sinon.stub()
      await this.SubscriptionController.pauseSubscription(
        this.req,
        this.res,
        this.next
      )
      expect(this.res.statusCode).to.equal(400)
    })

    it('should throw an error if an invalid pause length is provided', async function () {
      this.res = new MockResponse()
      this.req = new MockRequest()
      this.req.params = { pauseCycles: -10 }
      this.next = sinon.stub()
      await this.SubscriptionController.pauseSubscription(
        this.req,
        this.res,
        this.next
      )
      expect(this.res.statusCode).to.equal(400)
    })

    it('should return a 200 when requesting a pause', async function () {
      this.res = new MockResponse()
      this.req = new MockRequest()
      this.req.params = { pauseCycles: 3 }
      this.next = sinon.stub()
      await this.SubscriptionController.pauseSubscription(
        this.req,
        this.res,
        this.next
      )
      expect(this.res.statusCode).to.equal(200)
    })
  })

  describe('resumeSubscription', function () {
    it('should return a 200 when resuming a subscription', async function () {
      this.res = new MockResponse()
      this.req = new MockRequest()
      this.next = sinon.stub()
      await this.SubscriptionController.resumeSubscription(
        this.req,
        this.res,
        this.next
      )
      expect(this.res.statusCode).to.equal(200)
    })
  })

  describe('cancelSubscription', function () {
    beforeEach(function (done) {
      this.res = {
        redirect() {
          done()
        },
      }
      sinon.spy(this.res, 'redirect')
      this.SubscriptionController.cancelSubscription(this.req, this.res)
    })

    it('should tell the handler to cancel this user', function (done) {
      this.SubscriptionHandler.cancelSubscription
        .calledWith(this.user)
        .should.equal(true)
      done()
    })

    it('should redurect to the subscription page', function (done) {
      this.res.redirect
        .calledWith('/user/subscription/canceled')
        .should.equal(true)
      done()
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
            done()
          },
        }
        sinon.spy(this.res, 'sendStatus')
        this.SubscriptionController.recurlyCallback(this.req, this.res)
      })

      it('should tell the SubscriptionHandler to process the recurly callback', function (done) {
        this.SubscriptionHandler.syncSubscription.called.should.equal(true)
        done()
      })

      it('should send a 200', function (done) {
        this.res.sendStatus.calledWith(200)
        done()
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
            done()
          },
        }
        sinon.spy(this.res, 'sendStatus')
        this.SubscriptionController.recurlyCallback(this.req, this.res)
      })

      it('should not call the subscriptionshandler', function () {
        this.SubscriptionHandler.syncSubscription.called.should.equal(false)
        this.SubscriptionHandler.attemptPaypalInvoiceCollection.called.should.equal(
          false
        )
      })

      it('should respond with a 200 status', function () {
        this.res.sendStatus.calledWith(200)
      })
    })
  })
})
