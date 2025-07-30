const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

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
  describe('addHasAdminCapabilityToLocals', function () {
    describe('when getting capabilities from modules throws an error', function () {
      beforeEach(async function () {
        this.fireHook.rejects(new Error('Module error'))

        this.req = new MockRequest()
        this.res = new MockResponse()
        this.next = sinon.stub()

        this.user = {
          isAdmin: true,
        }

        this.req.logger = {
          warn: sinon.stub(),
        }

        this.req.session = {
          user: this.user,
        }

        await this.AdminAuthorizationHelper.addHasAdminCapabilityToLocals(
          this.req,
          this.res,
          this.next
        )
      })
      it('defines hasAdminCapability on res.locals', function () {
        expect(this.res.locals).to.have.property('hasAdminCapability')
      })
      it('returns false when called with any capability', function () {
        expect(this.res.locals.hasAdminCapability('capability1')).to.be.false
      })
      it('logs a warning', function () {
        expect(this.logger.warn).to.have.been.calledOnce
        expect(this.logger.warn.firstCall.args[0]).to.have.property('error')
        expect(this.logger.warn.firstCall.args[0].error.message).to.equal(
          'Module error'
        )
      })
    })
    describe('when admin capabilities are not available', function () {
      describe('user is null', function () {
        beforeEach(async function () {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()

          this.req.session = {
            user: null,
          }

          await this.AdminAuthorizationHelper.addHasAdminCapabilityToLocals(
            this.req,
            this.res,
            this.next
          )
        })
        it('defines hasAdminCapability on res.locals', function () {
          expect(this.res.locals).to.have.property('hasAdminCapability')
        })
        it('returns false when called with any capability', function () {
          expect(this.res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })
      describe('user is not an admin', function () {
        beforeEach(async function () {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()

          this.user = {
            isAdmin: false,
          }

          this.req.session = {
            user: this.user,
          }

          await this.AdminAuthorizationHelper.addHasAdminCapabilityToLocals(
            this.req,
            this.res,
            this.next
          )
        })
        it('defines hasAdminCapability on res.locals', function () {
          expect(this.res.locals).to.have.property('hasAdminCapability')
        })
        it('returns false when called with any capability', function () {
          expect(this.res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })
      describe('user is an admin', function () {
        beforeEach(async function () {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()

          this.user = {
            isAdmin: true,
          }

          this.req.session = {
            user: this.user,
          }

          await this.AdminAuthorizationHelper.addHasAdminCapabilityToLocals(
            this.req,
            this.res,
            this.next
          )
        })

        it('defines hasAdminCapability on res.locals', function () {
          expect(this.res.locals).to.have.property('hasAdminCapability')
        })
        it('returns true when called with any capability', function () {
          expect(this.res.locals.hasAdminCapability('capability1')).to.be.true
        })
      })
    })
    describe('when admin capabilities are available', function () {
      beforeEach(function () {
        this.fireHook.resolves(['capability1', 'capability2'])
      })
      describe('user is not an admin', function () {
        beforeEach(async function () {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()

          this.user = {
            isAdmin: false,
          }

          this.req.session = {
            user: this.user,
          }

          await this.AdminAuthorizationHelper.addHasAdminCapabilityToLocals(
            this.req,
            this.res,
            this.next
          )
        })
        it('defines hasAdminCapability on res.locals', function () {
          expect(this.res.locals).to.have.property('hasAdminCapability')
        })
        it('returns false when called with a capability the user has', function () {
          expect(this.res.locals.hasAdminCapability('capability1')).to.be.false
        })
        it('returns false when called with a capability the user does not have', function () {
          expect(this.res.locals.hasAdminCapability('capability3')).to.be.false
        })
      })
      describe('user is an admin', function () {
        beforeEach(async function () {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()

          this.user = {
            isAdmin: true,
          }

          this.req.session = {
            user: this.user,
          }

          await this.AdminAuthorizationHelper.addHasAdminCapabilityToLocals(
            this.req,
            this.res,
            this.next
          )
        })

        it('defines hasAdminCapability on res.locals', function () {
          expect(this.res.locals).to.have.property('hasAdminCapability')
        })
        it('returns true when called with a capability the user has', function () {
          expect(this.res.locals.hasAdminCapability('capability2')).to.be.true
        })
        it('returns false when called with a capability the user does not have', function () {
          expect(this.res.locals.hasAdminCapability('capability3')).to.be.false
        })
      })
    })
  })
})
