import { vi, expect } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const modulePath =
  '../../../../app/src/Features/Helpers/AdminAuthorizationHelper'

describe('AdminAuthorizationHelper', function () {
  beforeEach(async function (ctx) {
    ctx.fireHook = sinon.stub().resolves([])
    ctx.settings = {
      adminPrivilegeAvailable: true,
      adminUrl: 'https://admin.overleaf.com',
      adminRolesEnabled: true,
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: {
        promises: {
          hooks: {
            fire: ctx.fireHook,
          },
        },
      },
    }))

    ctx.AdminAuthorizationHelper = (await import(modulePath)).default
  })
  describe('getAdminCapabilities', function () {
    describe('when modules return capabilities', function () {
      let result
      const module1Capabilities = ['capability1', 'capability2']
      const module2Capabilities = ['capability2', 'capability3']

      beforeEach(async function (ctx) {
        ctx.fireHook.resolves([module1Capabilities, module2Capabilities])
        result = await ctx.AdminAuthorizationHelper.getAdminCapabilities({})
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
      beforeEach(async function (ctx) {
        result = await ctx.AdminAuthorizationHelper.getAdminCapabilities({})
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
        beforeEach(async function (ctx) {
          ctx.req = new MockRequest(vi)
          ctx.res = new MockResponse(vi)
          ctx.next = sinon.stub()

          ctx.req.session = {
            user: null,
          }

          await ctx.AdminAuthorizationHelper.useAdminCapabilities(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
        it('does not define adminCapabilitiesAvailable on req', function (ctx) {
          expect(ctx.req).not.to.have.property('adminCapabilitiesAvailable')
        })
        it('defines adminCapabilities as an empty array on req', function (ctx) {
          expect(ctx.req).to.have.property('adminCapabilities')
          expect(ctx.req.adminCapabilities).to.be.an('array')
          expect(ctx.req.adminCapabilities).to.be.empty
        })
      })
      describe('user is not an admin', function () {
        beforeEach(async function (ctx) {
          ctx.req = new MockRequest(vi)
          ctx.res = new MockResponse(vi)
          ctx.next = sinon.stub()

          ctx.user = {
            isAdmin: false,
          }

          ctx.req.session = {
            user: ctx.user,
          }

          await ctx.AdminAuthorizationHelper.useAdminCapabilities(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
        it('does not define adminCapabilitiesAvailable on req', function (ctx) {
          expect(ctx.req).not.to.have.property('adminCapabilitiesAvailable')
        })
        it('defines adminCapabilities as an empty array on req', function (ctx) {
          expect(ctx.req).to.have.property('adminCapabilities')
          expect(ctx.req.adminCapabilities).to.be.an('array')
          expect(ctx.req.adminCapabilities).to.be.empty
        })
      })
      describe('user is an admin', function () {
        beforeEach(async function (ctx) {
          ctx.req = new MockRequest(vi)
          ctx.res = new MockResponse(vi)
          ctx.next = sinon.stub()

          ctx.user = {
            isAdmin: true,
          }

          ctx.req.session = {
            user: ctx.user,
          }

          await ctx.AdminAuthorizationHelper.useAdminCapabilities(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('defines adminCapabilitiesAvailable as false on req', function (ctx) {
          expect(ctx.req).to.have.property('adminCapabilitiesAvailable', false)
        })

        it('defines adminCapabilities as an empty array', function (ctx) {
          expect(ctx.req).to.have.property('adminCapabilities')
          expect(ctx.req.adminCapabilities).to.be.an('array')
          expect(ctx.req.adminCapabilities).to.be.empty
        })
      })
    })
    describe('when admin capabilities are available', function () {
      beforeEach(function (ctx) {
        ctx.fireHook.resolves(['capability1', 'capability2'])
      })
      describe('user is not an admin', function () {
        beforeEach(async function (ctx) {
          ctx.req = new MockRequest(vi)
          ctx.res = new MockResponse(vi)
          ctx.next = sinon.stub()

          ctx.user = {
            isAdmin: false,
          }

          ctx.req.session = {
            user: ctx.user,
          }

          await ctx.AdminAuthorizationHelper.useAdminCapabilities(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
        it('does not define adminCapabilitiesAvailable on req', function (ctx) {
          expect(ctx.req).not.to.have.property('adminCapabilitiesAvailable')
        })
        it('defines adminCapabilities as an empty array on req', function (ctx) {
          expect(ctx.req).to.have.property('adminCapabilities')
          expect(ctx.req.adminCapabilities).to.be.an('array')
          expect(ctx.req.adminCapabilities).to.be.empty
        })
      })
      describe('user is an admin', function () {
        beforeEach(async function (ctx) {
          ctx.req = new MockRequest(vi)
          ctx.res = new MockResponse(vi)
          ctx.next = sinon.stub()

          ctx.user = {
            isAdmin: true,
          }

          ctx.req.session = {
            user: ctx.user,
          }

          await ctx.AdminAuthorizationHelper.useAdminCapabilities(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('defines adminCapabilitiesAvailable as true on req', function (ctx) {
          expect(ctx.req).to.have.property('adminCapabilitiesAvailable', true)
        })
        it('defines adminCapabilities with the capabilities returned from modules', function (ctx) {
          expect(ctx.req).to.have.property('adminCapabilities')
          expect(ctx.req.adminCapabilities).to.be.an('array')
          expect(ctx.req.adminCapabilities).to.include('capability1')
          expect(ctx.req.adminCapabilities).to.include('capability2')
        })
      })
    })
    describe('when getting capabilities from modules throws an error', function () {
      beforeEach(async function (ctx) {
        ctx.fireHook.rejects(new Error('Module error'))

        ctx.req = new MockRequest(vi)
        ctx.res = new MockResponse(vi)
        ctx.next = sinon.stub()

        ctx.user = {
          isAdmin: true,
        }

        ctx.req.logger = {
          warn: sinon.stub(),
        }

        ctx.req.session = {
          user: ctx.user,
        }

        await ctx.AdminAuthorizationHelper.useAdminCapabilities(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })
      it('logs the error', function (ctx) {
        expect(ctx.logger.warn).toHaveBeenCalled()
        expect(ctx.logger.warn.mock.calls[0][0].err).toBeInstanceOf(Error)
      })
      it('defines adminCapabilitiesAvailable as true on req', function (ctx) {
        expect(ctx.req).to.have.property('adminCapabilitiesAvailable', true)
      })
      it('defines adminCapabilities as an empty array', function (ctx) {
        expect(ctx.req).to.have.property('adminCapabilities')
        expect(ctx.req.adminCapabilities).to.be.an('array')
        expect(ctx.req.adminCapabilities).to.be.empty
      })
    })
  })
  describe('useHasAdminCapability', function () {
    it('adds hasAdminCapability to res.locals', function (ctx) {
      const req = new MockRequest(vi)
      const res = new MockResponse(vi)
      const next = sinon.stub()

      ctx.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

      expect(res.locals).to.have.property('hasAdminCapability')
      expect(res.locals.hasAdminCapability).to.be.a('function')
    })

    describe('when the user is not an admin', function () {
      describe('when req.adminCapabilitiesAvailable is true', function () {
        it('returns false for any capability', function (ctx) {
          const req = new MockRequest(vi)
          const res = new MockResponse(vi)
          const next = sinon.stub()

          req.adminCapabilitiesAvailable = true
          req.adminCapabilities = []

          req.session.user = { isAdmin: false }

          ctx.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })

      describe('when req.adminCapabilitiesAvailable is false', function () {
        it('returns false for any capability', function (ctx) {
          const req = new MockRequest(vi)
          const res = new MockResponse(vi)
          const next = sinon.stub()

          req.adminCapabilitiesAvailable = false
          req.adminCapabilities = []

          req.session.user = { isAdmin: false }

          ctx.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })

      describe('when req.adminCapabilitiesAvailable is undefined', function () {
        it('returns false for any capability', function (ctx) {
          const req = new MockRequest(vi)
          const res = new MockResponse(vi)
          const next = sinon.stub()

          req.session.user = { isAdmin: false }

          ctx.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.false
        })
      })
    })

    describe('user is an admin', function () {
      describe('when req.adminCapabilitiesAvailable is false', function () {
        it('returns true for any capability', function (ctx) {
          const req = new MockRequest(vi)
          const res = new MockResponse(vi)
          const next = sinon.stub()

          req.session.user = { isAdmin: true }
          req.adminCapabilitiesAvailable = false

          ctx.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.true
        })
      })

      describe('when req.adminCapabilitiesAvailable is undefined', function () {
        it('returns true for any capability', function (ctx) {
          const req = new MockRequest(vi)
          const res = new MockResponse(vi)
          const next = sinon.stub()

          req.session.user = { isAdmin: true }

          ctx.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)

          expect(res.locals.hasAdminCapability('capability1')).to.be.true
        })
      })

      describe('when req.adminCapabilitiesAvailable is true', function () {
        let req, res, next
        beforeEach(function (ctx) {
          req = new MockRequest(vi)
          res = new MockResponse(vi)
          next = sinon.stub()

          req.session.user = { isAdmin: true }
          req.adminCapabilitiesAvailable = true
          req.adminCapabilities = ['capability1', 'capability2']

          ctx.AdminAuthorizationHelper.useHasAdminCapability(req, res, next)
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
      it('returns false', function (ctx) {
        const req = {
          session: {
            user: { isAdmin: false },
          },
        }
        expect(
          ctx.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
        ).to.be.false
      })
    })
    describe('when user is an admin', function () {
      describe('when adminCapabilitiesAvailable is falsey', function () {
        it('returns true', function (ctx) {
          const req = {
            session: {
              user: { isAdmin: true },
            },
            adminCapabilitiesAvailable: false,
          }
          expect(
            ctx.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
          ).to.be.true
        })
        it('ignores the "requireAdminRoles" argument', function (ctx) {
          const req = {
            session: { user: { isAdmin: true } },
            adminCapabilitiesAvailable: false,
          }
          expect(
            ctx.AdminAuthorizationHelper.hasAdminCapability(
              'capability',
              true
            )(req)
          ).to.be.true
          expect(
            ctx.AdminAuthorizationHelper.hasAdminCapability(
              'capability',
              false
            )(req)
          ).to.be.true
        })
      })
      describe('when adminCapabilitiesAvailable is true', function () {
        describe('when user has the requested capability', function () {
          it('returns true', function (ctx) {
            const req = {
              session: { user: { isAdmin: true } },
              adminCapabilitiesAvailable: true,
              adminCapabilities: ['capability'],
            }
            expect(
              ctx.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
            ).to.be.true
          })
        })
        describe('when user does not have the requested capability', function () {
          it('returns false', function (ctx) {
            const req = {
              session: { user: { isAdmin: true } },
              adminCapabilitiesAvailable: true,
              adminCapabilities: ['other-capability'],
            }
            expect(
              ctx.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
            ).to.be.false
          })
        })
      })
    })

    describe('when admin roles are not enabled', function () {
      beforeEach(function (ctx) {
        ctx.settings.adminRolesEnabled = false
      })

      it('returns false even for admins', function (ctx) {
        const req = { session: { user: { isAdmin: true } } }
        expect(
          ctx.AdminAuthorizationHelper.hasAdminCapability('capability')(req)
        ).to.be.false
        expect(
          ctx.AdminAuthorizationHelper.hasAdminCapability(
            'capability',
            true
          )(req)
        ).to.be.false
      })
      it('returns true when requireAdminRoles=false', function (ctx) {
        const req = { session: { user: { isAdmin: true } } }
        expect(
          ctx.AdminAuthorizationHelper.hasAdminCapability(
            'capability',
            false
          )(req)
        ).to.be.true
      })
    })
  })
})
