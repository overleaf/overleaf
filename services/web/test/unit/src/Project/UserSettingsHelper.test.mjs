import { beforeEach, describe, expect, it } from 'vitest'
const modulePath = '../../../../app/src/Features/Project/UserSettingsHelper.mjs'

describe('UserSettingsHelper', function () {
  beforeEach(async function (ctx) {
    ctx.req = { query: {} }
    ctx.res = {}
    ctx.UserSettingsHelper = (await import(modulePath)).default
  })

  describe('overall theme', function () {
    it('should return the overall theme if set', async function (ctx) {
      const user = {
        ace: {
          overallTheme: 'light',
        },
        signUpDate: new Date('2022-01-01'),
      }

      const settings = await ctx.UserSettingsHelper.buildUserSettings(
        ctx.req,
        ctx.res,
        user
      )

      expect(settings.overallTheme).toBe('light')
    })

    it('should return system for new users with no overall theme set', async function (ctx) {
      const user = {
        ace: {},
        signUpDate: new Date('2026-03-16T00:00:00Z'),
      }

      const settings = await ctx.UserSettingsHelper.buildUserSettings(
        ctx.req,
        ctx.res,
        user
      )

      expect(settings.overallTheme).toBe('system')
    })

    it('should return dark for old users with no overall theme set', async function (ctx) {
      const user = {
        ace: {},
        signUpDate: new Date('2025-02-15T00:00:00Z'),
      }

      const settings = await ctx.UserSettingsHelper.buildUserSettings(
        ctx.req,
        ctx.res,
        user
      )

      expect(settings.overallTheme).toBe('')
    })
  })
})
