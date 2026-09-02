import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import { setReqValidationModeForTests } from '@overleaf/validation-tools'

const modulePath =
  '../../../../app/src/Features/Tutorial/TutorialController.mjs'

describe('TutorialController', function () {
  const userId = 'user-id-123'
  const validKey = 'workbench-consent'

  beforeEach(async function (ctx) {
    ctx.TutorialHandler = {
      setTutorialState: sinon.stub().resolves(),
    }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(userId),
    }

    vi.doMock('../../../../app/src/Features/Tutorial/TutorialHandler', () => ({
      default: ctx.TutorialHandler,
    }))
    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    ctx.controller = (await import(modulePath)).default

    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
  })

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  describe('completeTutorial', function () {
    it('should mark the tutorial as completed', async function (ctx) {
      ctx.req.params = { tutorialKey: validKey }
      await ctx.controller.completeTutorial(ctx.req, ctx.res, ctx.next)

      expect(
        ctx.TutorialHandler.setTutorialState.calledWith(
          userId,
          validKey,
          'completed'
        )
      ).to.equal(true)
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
    })

    describe('request validation', function () {
      beforeEach(function () {
        setReqValidationModeForTests('enforce')
      })

      it('should reject an unrecognized tutorial key with 404', async function (ctx) {
        ctx.req.params = { tutorialKey: 'not-a-real-tutorial' }
        await ctx.controller.completeTutorial(ctx.req, ctx.res, ctx.next)

        expect(ctx.TutorialHandler.setTutorialState.called).to.equal(false)
        expect(ctx.next.calledOnce).to.equal(true)
        expect(ctx.next.firstCall.args[0].name).to.equal('InvalidParamsError')
      })
    })

    describe('with the schema in log-only mode', function () {
      beforeEach(function () {
        setReqValidationModeForTests('log')
      })

      it('should still reject an unrecognized tutorial key with 404', async function (ctx) {
        ctx.req.params = { tutorialKey: 'not-a-real-tutorial' }
        await ctx.controller.completeTutorial(ctx.req, ctx.res, ctx.next)

        expect(ctx.TutorialHandler.setTutorialState.called).to.equal(false)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(404)
      })
    })
  })

  describe('postponeTutorial', function () {
    it('should postpone the tutorial with no postponedUntil', async function (ctx) {
      ctx.req.params = { tutorialKey: validKey }
      ctx.req.body = {}
      await ctx.controller.postponeTutorial(ctx.req, ctx.res, ctx.next)

      expect(
        ctx.TutorialHandler.setTutorialState.calledWith(
          userId,
          validKey,
          'postponed',
          undefined
        )
      ).to.equal(true)
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
    })

    it('should postpone the tutorial with a postponedUntil date', async function (ctx) {
      ctx.req.params = { tutorialKey: validKey }
      ctx.req.body = { postponedUntil: '2026-08-01T00:00:00.000Z' }
      await ctx.controller.postponeTutorial(ctx.req, ctx.res, ctx.next)

      const call = ctx.TutorialHandler.setTutorialState.lastCall
      expect(call.args[0]).to.equal(userId)
      expect(call.args[1]).to.equal(validKey)
      expect(call.args[2]).to.equal('postponed')
      expect(call.args[3]).to.be.an.instanceof(Date)
      expect(call.args[3].toISOString()).to.equal('2026-08-01T00:00:00.000Z')
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
    })

    it('tolerates a non-ISO postponedUntil value via the fallback schema', async function (ctx) {
      setReqValidationModeForTests('log')
      ctx.req.params = { tutorialKey: validKey }
      ctx.req.body = { postponedUntil: '2026/08/01' }
      await ctx.controller.postponeTutorial(ctx.req, ctx.res, ctx.next)

      const call = ctx.TutorialHandler.setTutorialState.lastCall
      expect(call.args[1]).to.equal(validKey)
      expect(call.args[2]).to.equal('postponed')
      expect(call.args[3]).to.be.an.instanceof(Date)
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
    })

    describe('request validation', function () {
      beforeEach(function () {
        setReqValidationModeForTests('enforce')
      })

      it('should reject an unrecognized tutorial key with 404', async function (ctx) {
        ctx.req.params = { tutorialKey: 'not-a-real-tutorial' }
        ctx.req.body = {}
        await ctx.controller.postponeTutorial(ctx.req, ctx.res, ctx.next)

        expect(ctx.TutorialHandler.setTutorialState.called).to.equal(false)
        expect(ctx.next.calledOnce).to.equal(true)
      })

      it('should reject a malformed postponedUntil value', async function (ctx) {
        ctx.req.params = { tutorialKey: validKey }
        ctx.req.body = { postponedUntil: 'not-a-date' }
        await ctx.controller.postponeTutorial(ctx.req, ctx.res, ctx.next)

        expect(ctx.TutorialHandler.setTutorialState.called).to.equal(false)
        expect(ctx.next.calledOnce).to.equal(true)
      })
    })

    describe('with the schema in log-only mode', function () {
      beforeEach(function () {
        setReqValidationModeForTests('log')
      })

      it('should still reject an unrecognized tutorial key with 404', async function (ctx) {
        ctx.req.params = { tutorialKey: 'not-a-real-tutorial' }
        ctx.req.body = {}
        await ctx.controller.postponeTutorial(ctx.req, ctx.res, ctx.next)

        expect(ctx.TutorialHandler.setTutorialState.called).to.equal(false)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(404)
      })
    })
  })
})
