import { vi } from 'vitest'
import sinon from 'sinon'
import { expect } from 'chai'
const modulePath = new URL(
  '../../../../app/src/Features/Cooldown/CooldownMiddleware.mjs',
  import.meta.url
).pathname

describe('CooldownMiddleware', function () {
  beforeEach(async function (ctx) {
    ctx.CooldownManager = { isProjectOnCooldown: sinon.stub() }

    vi.doMock(
      '../../../../app/src/Features/Cooldown/CooldownManager.js',
      () => ({
        default: ctx.CooldownManager,
      })
    )

    ctx.CooldownMiddleware = (await import(modulePath)).default
  })

  describe('freezeProject', function () {
    describe('when project is on cooldown', function () {
      beforeEach(function (ctx) {
        ctx.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, null, true)
        ctx.req = { params: { Project_id: 'abc' } }
        ctx.res = { sendStatus: sinon.stub() }
        return (ctx.next = sinon.stub())
      })

      it('should call CooldownManager.isProjectOnCooldown', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        ctx.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
        return ctx.CooldownManager.isProjectOnCooldown
          .calledWith('abc')
          .should.equal(true)
      })

      it('should not produce an error', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        return ctx.next.callCount.should.equal(0)
      })

      it('should send a 429 status', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        ctx.res.sendStatus.callCount.should.equal(1)
        return ctx.res.sendStatus.calledWith(429).should.equal(true)
      })
    })

    describe('when project is not on cooldown', function () {
      beforeEach(function (ctx) {
        ctx.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, null, false)
        ctx.req = { params: { Project_id: 'abc' } }
        ctx.res = { sendStatus: sinon.stub() }
        return (ctx.next = sinon.stub())
      })

      it('should call CooldownManager.isProjectOnCooldown', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        ctx.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
        return ctx.CooldownManager.isProjectOnCooldown
          .calledWith('abc')
          .should.equal(true)
      })

      it('call next with no arguments', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        ctx.next.callCount.should.equal(1)
        return expect(ctx.next.lastCall.args.length).to.equal(0)
      })
    })

    describe('when isProjectOnCooldown produces an error', function () {
      beforeEach(function (ctx) {
        ctx.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        ctx.req = { params: { Project_id: 'abc' } }
        ctx.res = { sendStatus: sinon.stub() }
        return (ctx.next = sinon.stub())
      })

      it('should call CooldownManager.isProjectOnCooldown', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        ctx.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
        return ctx.CooldownManager.isProjectOnCooldown
          .calledWith('abc')
          .should.equal(true)
      })

      it('call next with an error', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        ctx.next.callCount.should.equal(1)
        return expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })
    })

    describe('when projectId is not part of route', function () {
      beforeEach(function (ctx) {
        ctx.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, null, true)
        ctx.req = { params: { lol: 'abc' } }
        ctx.res = { sendStatus: sinon.stub() }
        return (ctx.next = sinon.stub())
      })

      it('call next with an error', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        ctx.next.callCount.should.equal(1)
        return expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should not call CooldownManager.isProjectOnCooldown', function (ctx) {
        ctx.CooldownMiddleware.freezeProject(ctx.req, ctx.res, ctx.next)
        return ctx.CooldownManager.isProjectOnCooldown.callCount.should.equal(0)
      })
    })
  })
})
