const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { ObjectId } = require('mongodb')
const { expect } = require('chai')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsReconfirmationHandler'
)

describe('InstitutionsReconfirmationHandler', function () {
  beforeEach(function () {
    this.InstitutionsReconfirmationHandler = SandboxedModule.require(
      modulePath,
      {
        requires: {
          '../../infrastructure/mongodb': (this.mongodb = {
            ObjectId,
            waitForDb: sinon.stub().resolves(),
          }),
          '../Subscription/FeaturesUpdater': (this.FeaturesUpdater = {
            refreshFeatures: sinon.stub(),
          }),
          './InstitutionsAPI': (this.InstitutionsAPI = {
            promises: {
              getUsersNeedingReconfirmationsLapsedProcessed: sinon.stub(),
              sendUsersWithReconfirmationsLapsedProcessed: sinon.stub(),
            },
          }),
        },
      }
    )
  })

  describe('userId list', function () {
    it('should throw an error if IDs not an array', async function () {
      let error
      try {
        await this.InstitutionsReconfirmationHandler.processLapsed()
      } catch (e) {
        error = e
      }
      expect(error).to.exist
      expect(error.message).to.equal('users is not an array')
    })
    it('should throw an error if IDs not valid ObjectIds', async function () {
      this.InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed.resolves(
        {
          data: { users: ['not an objectid'] },
        }
      )
      let error
      try {
        await this.InstitutionsReconfirmationHandler.processLapsed()
      } catch (e) {
        error = e
      }
      expect(error).to.exist
      expect(error.message).to.equal('user ID not valid')
    })
  })

  it('should log users that have refreshFeatures errors', async function () {
    const anError = new Error('oops')
    const aUserId = '5efb8b6e9b647b0027e4c0b0'
    this.FeaturesUpdater.refreshFeatures.yields(anError)
    this.InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed.resolves(
      {
        data: { users: [aUserId] },
      }
    )
    this.InstitutionsAPI.promises.sendUsersWithReconfirmationsLapsedProcessed.resolves()
    let error, result
    try {
      result = await this.InstitutionsReconfirmationHandler.processLapsed()
    } catch (e) {
      error = e
    }
    expect(error).to.not.exist
    expect(result.failedToRefresh.length).to.equal(1)
    expect(result.failedToRefresh[0]).to.equal(aUserId)
    expect(result.refreshedUsers.length).to.equal(0)
  })

  it('should log but not return errors from sendUsersWithReconfirmationsLapsedProcessed', async function () {
    const anError = new Error('oops')
    const aUserId = '5efb8b6e9b647b0027e4c0b0'
    this.FeaturesUpdater.refreshFeatures.yields()
    this.InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed.resolves(
      {
        data: { users: [aUserId] },
      }
    )
    this.InstitutionsAPI.promises.sendUsersWithReconfirmationsLapsedProcessed.rejects(
      anError
    )
    let error, result
    try {
      result = await this.InstitutionsReconfirmationHandler.processLapsed()
    } catch (e) {
      error = e
    }
    expect(error).to.not.exist
    expect(result.refreshedUsers.length).to.equal(1)
    expect(result.refreshedUsers[0]).to.equal(aUserId)
    expect(result.failedToRefresh.length).to.equal(0)
  })
})
