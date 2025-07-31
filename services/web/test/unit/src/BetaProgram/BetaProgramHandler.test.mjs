import { expect, vi } from 'vitest'
import path from 'node:path'

import sinon from 'sinon'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramHandler'
)

describe('BetaProgramHandler', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'some_id'
    ctx.user = {
      _id: ctx.user_id,
      email: 'user@example.com',
      features: {},
      betaProgram: false,
      save: sinon.stub().callsArgWith(0, null),
    }

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc: sinon.stub(),
      },
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: (ctx.UserUpdater = {
        promises: {
          updateUser: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: (ctx.AnalyticsManager = {
          setUserPropertyForUserInBackground: sinon.stub(),
        }),
      })
    )

    ctx.handler = (await import(modulePath)).default
  })

  describe('optIn', function () {
    beforeEach(function (ctx) {
      ctx.user.betaProgram = false
      ctx.call = callback => {
        ctx.handler.optIn(ctx.user_id, callback)
      }
    })

    it('should call userUpdater', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(err => {
          expect(err).to.not.exist
          ctx.UserUpdater.promises.updateUser.callCount.should.equal(1)
          resolve()
        })
      })
    })

    it('should set beta-program user property to true', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(err => {
          expect(err).to.not.exist
          sinon.assert.calledWith(
            ctx.AnalyticsManager.setUserPropertyForUserInBackground,
            ctx.user_id,
            'beta-program',
            true
          )
          resolve()
        })
      })
    })

    it('should not produce an error', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(err => {
          expect(err).to.not.exist
          resolve()
        })
      })
    })

    describe('when userUpdater produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserUpdater.promises.updateUser.rejects()
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(err => {
            expect(err).to.exist
            expect(err).to.be.instanceof(Error)
            resolve()
          })
        })
      })
    })
  })

  describe('optOut', function () {
    beforeEach(function (ctx) {
      ctx.user.betaProgram = true
      ctx.call = callback => {
        ctx.handler.optOut(ctx.user_id, callback)
      }
    })

    it('should call userUpdater', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(err => {
          expect(err).to.not.exist
          ctx.UserUpdater.promises.updateUser.callCount.should.equal(1)
          resolve()
        })
      })
    })

    it('should set beta-program user property to false', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(err => {
          expect(err).to.not.exist
          sinon.assert.calledWith(
            ctx.AnalyticsManager.setUserPropertyForUserInBackground,
            ctx.user_id,
            'beta-program',
            false
          )
          resolve()
        })
      })
    })

    it('should not produce an error', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(err => {
          expect(err).to.not.exist
          resolve()
        })
      })
    })

    describe('when userUpdater produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserUpdater.promises.updateUser.rejects()
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(err => {
            expect(err).to.exist
            expect(err).to.be.instanceof(Error)
            resolve()
          })
        })
      })
    })
  })
})
