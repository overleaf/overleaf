const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserPostRegistrationAnalyticsManager'
)

describe('UserPostRegistrationAnalyticsManager', function () {
  beforeEach(function () {
    this.fakeUserId = '123abc'
    this.postRegistrationAnalyticsQueue = {
      add: sinon.stub().resolves(),
      process: callback => {
        this.queueProcessFunction = callback
      },
    }
    this.Queues = {
      getPostRegistrationAnalyticsQueue: sinon
        .stub()
        .returns(this.postRegistrationAnalyticsQueue),
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves({ _id: this.fakeUserId }),
      },
    }
    this.InstitutionsAPI = {
      promises: {
        getUserAffiliations: sinon.stub().resolves([]),
      },
    }
    this.AnalyticsManager = {
      setUserProperty: sinon.stub().resolves(),
    }
    this.Features = {
      hasFeature: sinon.stub().returns(true),
    }
    this.init = isSAAS => {
      this.Features.hasFeature.withArgs('saas').returns(isSAAS)
      this.UserPostRegistrationAnalyticsManager = SandboxedModule.require(
        MODULE_PATH,
        {
          requires: {
            '../../infrastructure/Features': this.Features,
            '../../infrastructure/Queues': this.Queues,
            './UserGetter': this.UserGetter,
            '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
            '../Analytics/AnalyticsManager': this.AnalyticsManager,
          },
        }
      )
    }
  })

  describe('in Server CE/Pro', function () {
    beforeEach(function () {
      this.init(false)
    })

    it('should schedule delayed job on queue', function () {
      this.UserPostRegistrationAnalyticsManager.schedulePostRegistrationAnalytics(
        { _id: this.fakeUserId }
      )
      expect(this.Queues.getPostRegistrationAnalyticsQueue).to.not.have.been
        .called
      expect(this.postRegistrationAnalyticsQueue.add).to.not.have.been.called
    })
  })

  describe('in SAAS', function () {
    beforeEach(function () {
      this.init(true)
    })
    describe('schedule jobs in SAAS', function () {
      it('should schedule delayed job on queue', function () {
        this.UserPostRegistrationAnalyticsManager.schedulePostRegistrationAnalytics(
          {
            _id: this.fakeUserId,
          }
        )
        sinon.assert.calledWithMatch(
          this.postRegistrationAnalyticsQueue.add,
          { userId: this.fakeUserId },
          { delay: 24 * 60 * 60 * 1000 }
        )
      })
    })

    describe('process jobs', function () {
      it('stops without errors if user is not found', async function () {
        this.UserGetter.promises.getUser.resolves(null)
        await this.queueProcessFunction({ data: { userId: this.fakeUserId } })
        sinon.assert.calledWith(this.UserGetter.promises.getUser, {
          _id: this.fakeUserId,
        })
        sinon.assert.notCalled(
          this.InstitutionsAPI.promises.getUserAffiliations
        )
        sinon.assert.notCalled(this.AnalyticsManager.setUserProperty)
      })

      it('sets user property if user has commons account affiliationd', async function () {
        this.InstitutionsAPI.promises.getUserAffiliations.resolves([
          {},
          {
            institution: {
              commonsAccount: true,
            },
          },
          {
            institution: {
              commonsAccount: false,
            },
          },
        ])
        await this.queueProcessFunction({ data: { userId: this.fakeUserId } })
        sinon.assert.calledWith(this.UserGetter.promises.getUser, {
          _id: this.fakeUserId,
        })
        sinon.assert.calledWith(
          this.InstitutionsAPI.promises.getUserAffiliations,
          this.fakeUserId
        )
        sinon.assert.calledWith(
          this.AnalyticsManager.setUserProperty,
          this.fakeUserId,
          'registered-from-commons-account',
          true
        )
      })

      it('does not set user property if user has no commons account affiliation', async function () {
        this.InstitutionsAPI.promises.getUserAffiliations.resolves([
          {
            institution: {
              commonsAccount: false,
            },
          },
        ])
        await this.queueProcessFunction({ data: { userId: this.fakeUserId } })
        sinon.assert.notCalled(this.AnalyticsManager.setUserProperty)
      })
    })
  })
})
