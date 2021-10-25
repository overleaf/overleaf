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
    this.Queues = {
      createScheduledJob: sinon.stub().resolves(),
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(),
      },
    }
    this.UserGetter.promises.getUser
      .withArgs({ _id: this.fakeUserId })
      .resolves({ _id: this.fakeUserId })
    this.InstitutionsAPI = {
      promises: {
        getUserAffiliations: sinon.stub().resolves([]),
      },
    }
    this.AnalyticsManager = {
      setUserPropertyForUser: sinon.stub().resolves(),
    }
    this.UserPostRegistrationAnalyticsManager = SandboxedModule.require(
      MODULE_PATH,
      {
        requires: {
          '../../infrastructure/Queues': this.Queues,
          './UserGetter': this.UserGetter,
          '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
          '../Analytics/AnalyticsManager': this.AnalyticsManager,
        },
      }
    )
  })

  describe('schedulePostRegistrationAnalytics', function () {
    it('should schedule delayed job on queue', async function () {
      await this.UserPostRegistrationAnalyticsManager.schedulePostRegistrationAnalytics(
        {
          _id: this.fakeUserId,
        }
      )
      sinon.assert.calledWith(
        this.Queues.createScheduledJob,
        'post-registration-analytics',
        { data: { userId: this.fakeUserId } },
        24 * 60 * 60 * 1000
      )
    })
  })

  describe('postRegistrationAnalytics', function () {
    it('stops without errors if user is not found', async function () {
      await this.UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(
        'not-a-user'
      )
      expect(this.InstitutionsAPI.promises.getUserAffiliations).not.to.have.been
        .called
      expect(this.AnalyticsManager.setUserPropertyForUser).not.to.have.been
        .called
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
      await this.UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(
        this.fakeUserId
      )
      expect(
        this.AnalyticsManager.setUserPropertyForUser
      ).to.have.been.calledWith(
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
      await this.UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(
        this.fakeUserId
      )
      expect(this.AnalyticsManager.setUserPropertyForUser).not.to.have.been
        .called
    })
  })
})
