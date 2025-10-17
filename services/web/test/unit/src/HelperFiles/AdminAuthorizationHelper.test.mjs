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
    this.settings = {
      adminPrivilegeAvailable: true,
      adminUrl: 'https://admin.overleaf.com',
      adminRolesEnabled: true,
    }
    this.AdminAuthorizationHelper = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
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
  describe('useAdminCapabilities', function () {
    describe('when admin capabilities are not available', function () {
      describe('user is null', function () {
        beforeEach(async function () {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()

          this.req.session = {
            user: null,
          }

          await this.AdminAuthorizationHelper.useAdminCapabilities(
            this.req,
            this.res,
            this.next
          )
        })
        it('does not define adminCapabilitiesAvailable on req', function () {
          expect(this.req).not.to.have.property('adminCapabilitiesAvailable')
        })
        it('defines adminCapabilities as an empty array on req', function () {
          expect(this.req).to.have.property('adminCapabilities')
          expect(this.req.adminCapabilities).to.be.an('array')
          expect(this.req.adminCapabilities).to.be.empty
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

          await this.AdminAuthorizationHelper.useAdminCapabilities(
            this.req,
            this.res,
            this.next
          )
        })
        it('does not define adminCapabilitiesAvailable on req', function () {
          expect(this.req).not.to.have.property('adminCapabilitiesAvailable')
        })
        it('defines adminCapabilities as an empty array on req', function () {
          expect(this.req).to.have.property('adminCapabilities')
          expect(this.req.adminCapabilities).to.be.an('array')
          expect(this.req.adminCapabilities).to.be.empty
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

          await this.AdminAuthorizationHelper.useAdminCapabilities(
            this.req,
            this.res,
            this.next
          )
        })

        it('defines adminCapabilitiesAvailable as false on req', function () {
          expect(this.req).to.have.property('adminCapabilitiesAvailable', false)
        })

        it('defines adminCapabilities as an empty array', function () {
          expect(this.req).to.have.property('adminCapabilities')
          expect(this.req.adminCapabilities).to.be.an('array')
          expect(this.req.adminCapabilities).to.be.empty
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

          await this.AdminAuthorizationHelper.useAdminCapabilities(
            this.req,
            this.res,
            this.next
          )
        })
        it('does not define adminCapabilitiesAvailable on req', function () {
          expect(this.req).not.to.have.property('adminCapabilitiesAvailable')
        })
        it('defines adminCapabilities as an empty array on req', function () {
          expect(this.req).to.have.property('adminCapabilities')
          expect(this.req.adminCapabilities).to.be.an('array')
          expect(this.req.adminCapabilities).to.be.empty
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

          await this.AdminAuthorizationHelper.useAdminCapabilities(
            this.req,
            this.res,
            this.next
          )
        })

        it('defines adminCapabilitiesAvailable as true on req', function () {
          expect(this.req).to.have.property('adminCapabilitiesAvailable', true)
        })
        it('defines adminCapabilities with the capabilities returned from modules', function () {
          expect(this.req).to.have.property('adminCapabilities')
          expect(this.req.adminCapabilities).to.be.an('array')
          expect(this.req.adminCapabilities).to.include('capability1')
          expect(this.req.adminCapabilities).to.include('capability2')
        })
      })
    })
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

        await this.AdminAuthorizationHelper.useAdminCapabilities(
          this.req,
          this.res,
          this.next
        )
      })
      it('logs the error', function () {
        expect(this.logger.warn).to.have.been.calledWith(
          sinon.match.has('err', sinon.match.instanceOf(Error))
        )
      })
      it('defines adminCapabilitiesAvailable as true on req', function () {
        expect(this.req).to.have.property('adminCapabilitiesAvailable', true)
      })
      it('defines adminCapabilities as an empty array', function () {
        expect(this.req).to.have.property('adminCapabilities')
        expect(this.req.adminCapabilities).to.be.an('array')
        expect(this.req.adminCapabilities).to.be.empty
      })
    })
  })
  describe('useHasAdminCapability', function () {
    it('adds hasAdminCapability to res.locals', function () {
      const req = new MockRequest()
      const res = new MockResponse()
      const next = sinon.stub()

      this.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

      expect(res.locals).to.have.property('hasAdminCapability')
      expect(res.locals.hasAdminCapability).to.be.a('function')
    })

    describe('when the user is not an admin', function () {
      describe('when req.adminCapabilitiesAvailable is true', function () {
        it('returns false for any capability', function () {
          const req = new MockRequest()
          const res = new MockResponse()
          const next = sinon.stub()

          req.adminCapabilitiesAvailable = true
          req.adminCapabilities = []

          req.session.user = { isAdmin: false }

          this.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })

      describe('when req.adminCapabilitiesAvailable is false', function () {
        it('returns false for any capability', function () {
          const req = new MockRequest()
          const res = new MockResponse()
          const next = sinon.stub()

          req.adminCapabilitiesAvailable = false
          req.adminCapabilities = []

          req.session.user = { isAdmin: false }

          this.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })

      describe('when req.adminCapabilitiesAvailable is undefined', function () {
        it('returns false for any capability', function () {
          const req = new MockRequest()
          const res = new MockResponse()
          const next = sinon.stub()

          req.session.user = { isAdmin: false }

          this.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })
    })

    describe('user is an admin', function () {
      describe('when req.adminCapabilitiesAvailable is false', function () {
        it('returns true for any capability', function () {
          const req = new MockRequest()
          const res = new MockResponse()
          const next = sinon.stub()

          req.session.user = { isAdmin: true }
          req.adminCapabilitiesAvailable = false

          this.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.true
        })
      })

      describe('when req.adminCapabilitiesAvailable is undefined', function () {
        it('returns true for any capability', function () {
          const req = new MockRequest()
          const res = new MockResponse()
          const next = sinon.stub()

          req.session.user = { isAdmin: true }

          this.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.true
        })
      })

      describe('when req.adminCapabilitiesAvailable is true', function () {
        let req, res, next
        beforeEach(function () {
          req = new MockRequest()
          res = new MockResponse()
          next = sinon.stub()

          req.session.user = { isAdmin: true }
          req.adminCapabilitiesAvailable = true
          req.adminCapabilities = ['capability1', 'capability2']

          this.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)
        })

        it('returns true for a capability the user has', function () {
          expect(res.locals.hasAdminCapability('capability1')).to.be.true
        })

        it('returns false for a capability the user does not have', function () {
          expect(res.locals.hasAdminCapability('capability3')).to.be.false
        })
      })
    })
  })
  describe('hasAdminCapability', function () {
    describe('when user is not an admin', function () {
      it('returns false', function () {
        const req = {
          session: {
            user: { isAdmin: false },
          },
        }
        expect(
          this.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
        ).to.be.false
      })
    })
    describe('when user is an admin', function () {
      describe('when adminCapabilitiesAvailable is falsey', function () {
        it('returns true', function () {
          const req = {
            session: {
              user: { isAdmin: true },
            },
            adminCapabilitiesAvailable: false,
          }
          expect(
            this.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
          ).to.be.true
        })
        it('ignores the "requireAdminRoles" argument', function () {
          const req = {
            session: { user: { isAdmin: true } },
            adminCapabilitiesAvailable: false,
          }
          expect(
            this.AdminAuthorizationHelper.hasAdminCapability(
              'capability',
              true
            )(req)
          ).to.be.true
          expect(
            this.AdminAuthorizationHelper.hasAdminCapability(
              'capability',
              false
            )(req)
          ).to.be.true
        })
      })
      describe('when adminCapabilitiesAvailable is true', function () {
        describe('when user has the requested capability', function () {
          it('returns true', function () {
            const req = {
              session: { user: { isAdmin: true } },
              adminCapabilitiesAvailable: true,
              adminCapabilities: ['capability'],
            }
            expect(
              this.AdminAuthorizationHelper.hasAdminCapability('capability')(
                req
              )
            ).to.be.true
          })
        })
        describe('when user does not have the requested capability', function () {
          it('returns false', function () {
            const req = {
              session: { user: { isAdmin: true } },
              adminCapabilitiesAvailable: true,
              adminCapabilities: ['other-capability'],
            }
            expect(
              this.AdminAuthorizationHelper.hasAdminCapability('capability')(
                req
              )
            ).to.be.false
          })
        })
      })
    })

    describe('when admin roles are not enabled', function () {
      beforeEach(function () {
        this.settings.adminRolesEnabled = false
      })

      it('returns false even for admins', function () {
        const req = { session: { user: { isAdmin: true } } }
        expect(
          this.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
        ).to.be.false
        expect(
          this.AdminAuthorizationHelper.hasAdminCapability(
            'capability',
            true
          )(req)
        ).to.be.false
      })
      it('returns true when requireAdminRoles=false', function () {
        const req = { session: { user: { isAdmin: true } } }
        expect(
          this.AdminAuthorizationHelper.hasAdminCapability(
            'capability',
            false
          )(req)
        ).to.be.true
      })
    })
  })
})
