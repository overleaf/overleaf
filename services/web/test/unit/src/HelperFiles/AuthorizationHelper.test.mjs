import { vi, expect } from 'vitest'

const modulePath = '../../../../app/src/Features/Helpers/AuthorizationHelper'

describe('AuthorizationHelper', function () {
  beforeEach(async function (ctx) {
    vi.doMock('../../../../app/src/models/User', () => ({
      UserSchema: {
        obj: {
          staffAccess: {
            publisherMetrics: {},
            publisherManagement: {},
            institutionMetrics: {},
            institutionManagement: {},
            groupMetrics: {},
            groupManagement: {},
            adminMetrics: {},
          },
        },
      },
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = { promises: {} }),
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: (ctx.SplitTestHandler = {
          promises: {},
        }),
      })
    )

    ctx.AuthorizationHelper = (await import(modulePath)).default
  })

  describe('hasAnyStaffAccess', function () {
    it('with empty user', function (ctx) {
      const user = {}
      expect(ctx.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })

    it('with no access user', function (ctx) {
      const user = { isAdmin: false, staffAccess: { adminMetrics: false } }
      expect(ctx.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })

    it('with admin user', function (ctx) {
      const user = { isAdmin: true }
      expect(ctx.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })

    it('with staff user', function (ctx) {
      const user = { staffAccess: { adminMetrics: true, somethingElse: false } }
      expect(ctx.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.true
    })

    it('with non-staff user with extra attributes', function (ctx) {
      // make sure that staffAccess attributes not declared on the model don't
      // give user access
      const user = { staffAccess: { adminMetrics: false, somethingElse: true } }
      expect(ctx.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })
  })
})
