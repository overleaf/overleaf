const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipAuthorization'

describe('UserMembershipAuthorization', function () {
  let hasAdminAccess, UserMembershipAuthorization
  beforeEach(function () {
    hasAdminAccess = sinon.stub().returns(true)
    UserMembershipAuthorization = SandboxedModule.require(modulePath, {
      requires: {
        '../Helpers/AdminAuthorizationHelper': {
          hasAdminAccess,
        },
      },
    })
  })
  describe('hasAdminCapability', function () {
    describe('when user is not an admin', function () {
      it('returns false', function () {
        hasAdminAccess.returns(false)
        const req = { user: {} }
        expect(
          UserMembershipAuthorization.hasAdminCapability('capability')(req)
        ).to.be.false
      })
    })
    describe('when user is an admin', function () {
      describe('when adminCapabilitiesAvailable is falsey', function () {
        it('returns true', function () {
          const req = { user: {}, adminCapabilitiesAvailable: false }
          expect(
            UserMembershipAuthorization.hasAdminCapability('capability')(req)
          ).to.be.true
        })
      })
      describe('when adminCapabilitiesAvailable is true', function () {
        describe('when user has the requested capability', function () {
          it('returns true', function () {
            const req = {
              user: {},
              adminCapabilitiesAvailable: true,
              adminCapabilities: ['capability'],
            }
            expect(
              UserMembershipAuthorization.hasAdminCapability('capability')(req)
            ).to.be.true
          })
        })
        describe('when user does not have the requested capability', function () {
          it('returns false', function () {
            const req = {
              user: {},
              adminCapabilitiesAvailable: true,
              adminCapabilities: ['other-capability'],
            }
            expect(
              UserMembershipAuthorization.hasAdminCapability('capability')(req)
            ).to.be.false
          })
        })
      })
    })
  })
})
