const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/User/UserHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('UserHandler', function () {
  beforeEach(function () {
    this.user = {
      _id: '12390i',
      email: 'bob@bob.com',
      remove: sinon.stub().callsArgWith(0)
    }

    this.TeamInvitesHandler = {
      createTeamInvitesForLegacyInvitedEmail: sinon.stub().yields()
    }

    this.UserHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../Subscription/TeamInvitesHandler': this.TeamInvitesHandler
      }
    })
  })

  describe('populateTeamInvites', function () {
    beforeEach(function (done) {
      this.UserHandler.populateTeamInvites(this.user, done)
    })

    it('notifies the user about legacy team invites', function () {
      this.TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail
        .calledWith(this.user.email)
        .should.eq(true)
    })
  })
})
