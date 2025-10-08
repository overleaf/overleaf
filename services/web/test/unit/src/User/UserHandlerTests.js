const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/User/UserHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('UserHandler', function () {
  beforeEach(function () {
    this.user = {
      _id: '12390i',
      email: 'bob@bob.com',
      remove: sinon.stub().callsArgWith(0),
    }

    this.TeamInvitesHandler = {
      promises: {
        createTeamInvitesForLegacyInvitedEmail: sinon.stub().resolves(),
      },
    }

    this.db = {
      users: {
        countDocuments: sinon.stub().resolves(2),
      },
    }

    this.UserHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../Subscription/TeamInvitesHandler': this.TeamInvitesHandler,
        '../../infrastructure/mongodb': { db: this.db },
      },
    })
  })

  describe('populateTeamInvites', function () {
    beforeEach(async function () {
      await this.UserHandler.promises.populateTeamInvites(this.user)
    })

    it('notifies the user about legacy team invites', function () {
      this.TeamInvitesHandler.promises.createTeamInvitesForLegacyInvitedEmail
        .calledWith(this.user.email)
        .should.eq(true)
    })
  })

  describe('countActiveUsers', function () {
    it('return user count from DB lookup', async function () {
      expect(await this.UserHandler.promises.countActiveUsers()).to.equal(2)
    })
  })
})
