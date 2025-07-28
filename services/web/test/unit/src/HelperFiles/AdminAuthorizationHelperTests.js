const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')

const modulePath =
  '../../../../app/src/Features/Helpers/AdminAuthorizationHelper'

describe('AdminAuthorizationHelper', function () {
  beforeEach(function () {
    this.fireHook = sinon.stub().resolves([])
    this.AdminAuthorizationHelper = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': {
          adminPrivilegeAvailable: true,
          adminUrl: 'https://admin.overleaf.com',
        },
        '../../infrastructure/Modules': {
          promises: {
            hooks: {
              fire: this.fireHook,
            },
          },
        },
      },
    })
  })
  describe('getAdminCapabilities', function () {
    describe('when modules return capabilities', function () {
      let result
      const module1Capabilities = ['capability1', 'capability2']
      const module2Capabilities = ['capability2', 'capability3']

      beforeEach(async function () {
        this.fireHook.resolves([module1Capabilities, module2Capabilities])
        result = await this.AdminAuthorizationHelper.getAdminCapabilities({})
      })
      it('returns true for adminCapabilitiesAvailable', async function () {
        expect(result.adminCapabilitiesAvailable).to.be.true
      })
      it('returns a flattened array of the returned capabilities', function () {
        expect(result.adminCapabilities)
          .to.be.an('array')
          .that.includes(...module1Capabilities, ...module2Capabilities)
      })
    })
    describe('when no module returns capabilities', function () {
      let result
      beforeEach(async function () {
        result = await this.AdminAuthorizationHelper.getAdminCapabilities({})
      })

      it('returns false for adminCapabilitiesAvailable', function () {
        expect(result.adminCapabilitiesAvailable).to.be.false
      })
      it('returns an empty adminCapabilities array', function () {
        expect(result.adminCapabilities).to.be.an('array').that.is.empty
      })
    })
  })
})
