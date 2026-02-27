import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath = '../../../../app/src/Features/Project/UserSettingsHelper.mjs'

describe('UserSettingsHelper', function () {
  beforeEach(async function (ctx) {
    ctx.SplitTestHandler = {
      promises: { getAssignment: sinon.stub() },
    }

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    ctx.req = { query: {} }
    ctx.res = {}
    ctx.UserSettingsHelper = (await import(modulePath)).default
  })

  describe('for user with overall theme set to value', function () {
    beforeEach(async function (ctx) {
      const user = {
        ace: {
          overallTheme: 'light',
        },
        signUpDate: new Date('2022-01-01'),
      }

      ctx.settings = await ctx.UserSettingsHelper.buildUserSettings(
        ctx.req,
        ctx.res,
        user
      )
    })

    it('should return the user settings with the correct overall theme', function (ctx) {
      expect(ctx.settings.overallTheme).toBe('light')
    })

    it('should not check split test', function (ctx) {
      expect(ctx.SplitTestHandler.promises.getAssignment).not.toHaveBeenCalled
    })
  })

  describe('for user with no overall theme set', function () {
    describe('for new users in treatment group', function () {
      beforeEach(async function (ctx) {
        const user = {
          ace: {},
          signUpDate: new Date('2027-02-16T00:00:00Z'),
        }

        ctx.SplitTestHandler.promises.getAssignment
          .withArgs(ctx.req, ctx.res, 'new-user-system-overall-theme')
          .resolves({
            variant: 'system',
          })

        ctx.settings = await ctx.UserSettingsHelper.buildUserSettings(
          ctx.req,
          ctx.res,
          user
        )
      })

      it('should default to system theme', function (ctx) {
        expect(ctx.settings.overallTheme).toBe('system')
      })

      it('should check split test', function (ctx) {
        expect(ctx.SplitTestHandler.promises.getAssignment).toHaveBeenCalled
      })
    })

    describe('for new users in control group', function () {
      beforeEach(async function (ctx) {
        const user = {
          ace: {},
          signUpDate: new Date('2027-02-16T00:00:00Z'),
        }

        ctx.SplitTestHandler.promises.getAssignment
          .withArgs(ctx.req, ctx.res, 'new-user-system-overall-theme')
          .resolves({
            variant: 'default',
          })

        ctx.settings = await ctx.UserSettingsHelper.buildUserSettings(
          ctx.req,
          ctx.res,
          user
        )
      })

      it('should default to dark theme', function (ctx) {
        expect(ctx.settings.overallTheme).toBe('')
      })

      it('should check split test', function (ctx) {
        expect(ctx.SplitTestHandler.promises.getAssignment).toHaveBeenCalled
      })
    })

    describe('for old users in control group', function () {
      beforeEach(async function (ctx) {
        const user = {
          ace: {},
          signUpDate: new Date('2025-02-15T00:00:00Z'),
        }

        ctx.SplitTestHandler.promises.getAssignment
          .withArgs(ctx.req, ctx.res, 'new-user-system-overall-theme')
          .resolves({
            variant: 'default',
          })

        ctx.settings = await ctx.UserSettingsHelper.buildUserSettings(
          ctx.req,
          ctx.res,
          user
        )
      })

      it('should default to dark theme', function (ctx) {
        expect(ctx.settings.overallTheme).toBe('')
      })

      it('should not check split test', function (ctx) {
        expect(ctx.SplitTestHandler.promises.getAssignment).not.toHaveBeenCalled
      })
    })

    describe('for old users in treatment group', function () {
      beforeEach(async function (ctx) {
        const user = {
          ace: {},
          signUpDate: new Date('2025-02-15T00:00:00Z'),
        }

        ctx.SplitTestHandler.promises.getAssignment
          .withArgs(ctx.req, ctx.res, 'new-user-system-overall-theme')
          .resolves({
            variant: 'system',
          })

        ctx.settings = await ctx.UserSettingsHelper.buildUserSettings(
          ctx.req,
          ctx.res,
          user
        )
      })

      it('should default to dark theme', function (ctx) {
        expect(ctx.settings.overallTheme).toBe('')
      })

      it('should not check split test', function (ctx) {
        expect(ctx.SplitTestHandler.promises.getAssignment).not.toHaveBeenCalled
      })
    })
  })
})
