/* eslint-disable
    max-len,
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
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const modulePath = '../../../../app/src/Features/User/UserHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('UserHandler', function() {
  beforeEach(function() {
    this.user = {
      _id: '12390i',
      email: 'bob@bob.com',
      remove: sinon.stub().callsArgWith(0)
    }

    this.TeamInvitesHandler = {
      createTeamInvitesForLegacyInvitedEmail: sinon.stub().yields()
    }

    return (this.UserHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Subscription/TeamInvitesHandler': this.TeamInvitesHandler
      }
    }))
  })

  describe('populateTeamInvites', function() {
    beforeEach(function(done) {
      return this.UserHandler.populateTeamInvites(this.user, done)
    })

    it('notifies the user about legacy team invites', function() {
      return this.TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail
        .calledWith(this.user.email)
        .should.eq(true)
    })
  })
})
